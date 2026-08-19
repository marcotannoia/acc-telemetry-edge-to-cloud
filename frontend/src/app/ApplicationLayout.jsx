import { Outlet } from 'react-router-dom'

export default function ApplicationLayout() {
  return (
    <main className="applicazione">
      <Outlet />
    </main>
  )
}
