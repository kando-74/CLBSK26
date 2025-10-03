import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Home } from './pages/Home'
import { Library } from './pages/Library'
import { Register } from './pages/Register'
import { Board } from './pages/Board'
import { Profile } from './pages/Profile'
import { Statistics } from './pages/Statistics'
import { Access } from './pages/Access'
import { Organization } from './pages/Organization'
import { UserProfilePublic } from './pages/UserProfilePublic'
import { UsersDirectory } from './pages/Users'
import { RequireAuth } from './components/RequireAuth'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/acceso" element={<Access />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/" element={<Home />} />
          <Route path="/ludoteca" element={<Library />} />
          <Route path="/registrar" element={<Register />} />
          <Route path="/estadisticas" element={<Statistics />} />
          <Route path="/tablon" element={<Board />} />
          <Route path="/usuarios" element={<UsersDirectory />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/personas/:alias" element={<UserProfilePublic />} />
          <Route path="/organizacion" element={<Organization />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
