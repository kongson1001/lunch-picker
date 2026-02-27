import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Home from './pages/Home';
import Room from './pages/Room';
import Result from './pages/Result';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/room/:roomId/result" element={<Result />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
