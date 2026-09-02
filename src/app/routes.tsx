import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell.tsx'
import { ProtectedLayout } from '../components/layout/ProtectedLayout.tsx'
import { NotFoundPage } from '../components/feedback/NotFoundPage.tsx'
import { AuthPage } from '../features/auth/components/AuthPage.tsx'
import { CalendarPage } from '../features/calendar/components/CalendarPage.tsx'
import { NotesPage } from '../features/notes/components/NotesPage.tsx'
import { PersonalGroupsPage } from '../features/personal-groups/components/PersonalGroupsPage.tsx'
import { SubjectsPage } from '../features/subjects/components/SubjectsPage.tsx'
import { DeviceTokensPage } from '../features/devices/components/DeviceTokensPage.tsx'
import { ProtectedRoute } from './ProtectedRoute.tsx'

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/calendar" replace /> },
      { path: 'login', element: <AuthPage mode="login" /> },
      { path: 'register', element: <AuthPage mode="register" /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <ProtectedLayout />,
            children: [
              { path: 'calendar', element: <CalendarPage /> },
              { path: 'subjects', element: <SubjectsPage /> },
              { path: 'personal-groups', element: <PersonalGroupsPage /> },
              { path: 'notes', element: <NotesPage /> },
              { path: 'devices', element: <DeviceTokensPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
