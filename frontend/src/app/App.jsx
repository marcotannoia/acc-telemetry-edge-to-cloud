import { RouterProvider } from 'react-router-dom'
import '../styles/application.css'
import { AppProviders } from './providers.jsx'
import { router } from './router.jsx'

function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}

export default App
