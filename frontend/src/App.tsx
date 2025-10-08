
import { Access } from './pages/Access'
import { Calendar } from './pages/Calendar'
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
          <Route path="/" element={<Calendar />} />
          <Route path="/ludoteca" element={<Library />} />
          <Route path="/registrar" element={<Register />} />
          <Route path="/estadisticas" element={<Statistics />} />
          <Route path="/tablon" element={<BoardPage />} />
          <Route path="/usuarios" element={<UsersDirectory />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/personas/:uid" element={<UserProfilePublic />} />
          <Route path="/organizacion" element={<Organization />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App