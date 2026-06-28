import base64
import hashlib
import json
import os
import secrets
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen


COGNITO_CLIENT_ID = os.environ.get("COGNITO_CLIENT_ID", "")
COGNITO_DOMAIN = os.environ.get("COGNITO_DOMAIN", "")
COGNITO_REDIRECT_URI = os.environ.get("COGNITO_REDIRECT_URI", "http://localhost:8765/callback")
COGNITO_SCOPES = "openid email profile"


def _base64_url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _decode_jwt_payload(token):
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload.encode("utf-8")))


def _wait_for_auth_code(redirect_uri, expected_state):
    parsed_redirect = urlparse(redirect_uri)
    result = {}

    class CallbackHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            params = parse_qs(urlparse(self.path).query)
            result["code"] = params.get("code", [None])[0]
            result["state"] = params.get("state", [None])[0]
            result["error"] = params.get("error", [None])[0]

            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Login completato. Puoi chiudere questa finestra.")

        def log_message(self, *_):
            return

    server = HTTPServer(("127.0.0.1", parsed_redirect.port), CallbackHandler)
    server.timeout = 180
    server.handle_request()
    server.server_close()

    if result.get("error"):
        raise RuntimeError(f"Login Cognito fallito: {result['error']}")
    if result.get("state") != expected_state:
        raise RuntimeError("Login Cognito non valido: state non corrispondente.")
    if not result.get("code"):
        raise RuntimeError("Login Cognito scaduto o annullato.")

    return result["code"]


def login_cognito_user():
    if not COGNITO_CLIENT_ID or not COGNITO_DOMAIN:
        fallback_user = os.environ.get("ACC_USER_ID", "personal-user")
        print(f"Cognito non configurato: uso user_id locale '{fallback_user}'.")
        return fallback_user

    cognito_domain = COGNITO_DOMAIN.removeprefix("https://").rstrip("/")
    code_verifier = _base64_url(secrets.token_bytes(32))
    code_challenge = _base64_url(hashlib.sha256(code_verifier.encode("utf-8")).digest())
    state = secrets.token_urlsafe(16)

    auth_url = f"https://{cognito_domain}/oauth2/authorize?{urlencode({
        'client_id': COGNITO_CLIENT_ID,
        'response_type': 'code',
        'scope': COGNITO_SCOPES,
        'redirect_uri': COGNITO_REDIRECT_URI,
        'code_challenge_method': 'S256',
        'code_challenge': code_challenge,
        'state': state,
    })}"

    print("Apro il browser per il login Cognito...")
    webbrowser.open(auth_url)
    auth_code = _wait_for_auth_code(COGNITO_REDIRECT_URI, state)

    token_body = urlencode({
        "grant_type": "authorization_code",
        "client_id": COGNITO_CLIENT_ID,
        "code": auth_code,
        "redirect_uri": COGNITO_REDIRECT_URI,
        "code_verifier": code_verifier,
    }).encode("utf-8")

    token_request = Request(
        f"https://{cognito_domain}/oauth2/token",
        data=token_body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    tokens = json.loads(urlopen(token_request, timeout=20).read().decode("utf-8"))
    user_id = _decode_jwt_payload(tokens["id_token"])["sub"]
    print("Login completato. Telemetria associata all'utente Cognito.")
    return user_id
