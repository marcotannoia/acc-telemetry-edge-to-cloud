import { Navigate, createHashRouter } from 'react-router-dom'
import AccessPage from '../pages/AccessPage.jsx'
import LivePage from '../pages/LivePage.jsx'
import MenuPage from '../pages/MenuPage.jsx'
import SessionPage from '../pages/SessionPage.jsx'
import SessionsPage from '../pages/SessionsPage.jsx'
import ApplicationLayout from './ApplicationLayout.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'

// Hash routing keeps direct links and refreshes compatible with the static
// S3/CloudFront hosting, without requiring server-side URL rewrites.
export const router = createHashRouter([
  {
    path: '/',
    element: <ApplicationLayout />,
    children: [
      { index: true, element: <AccessPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'menu', element: <MenuPage /> },
          { path: 'sessions', element: <SessionsPage /> },
          { path: 'sessions/:sessionId', element: <SessionPage /> },
          { path: 'live', element: <LivePage /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
