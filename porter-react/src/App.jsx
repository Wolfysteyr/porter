import {BrowserRouter, Routes, Route} from "react-router-dom";
import Home from "./Pages/Home";
import Layout from "./Pages/Layout";
import Login from "./Pages/Auth/Login";
import Register from "./Pages/Auth/Register.jsx";
import TQB from "./Pages/Views/TQB.jsx";
import Templates from "./Pages/Views/Templates.jsx";
import Export from "./Pages/Views/Export.jsx";
import SetPassword from "./Pages/Auth/SetPassword.jsx";
import Databases from "./Pages/Views/Databases.jsx";

import './App.css'
import { useContext } from "react";
import { AppContext } from "./Context/AppContext.jsx";

function App() {

  const {user} = useContext(AppContext);

  return <BrowserRouter>
    <Routes>
      <Route path="/" element={<Layout/>}>

        <Route index element={<Home/>}/>
        <Route path="/login" element={ user ? <Home/> : <Login/>}/> 
        <Route path="/register" element={ (user) ? (user.admin === 1 ? <Register/> : <Home/>) : <Login/> }/>
        <Route path="/tqb" element={user ? <TQB/> : <Login/>}/>
        <Route path="/templates" element={user ? <Templates/> : <Login/>}/>
        <Route path="/export" element={user ? <Export/> : <Login/>}/>
        <Route path="/set-password" element={<SetPassword/>}/>
        <Route path="/databases" element={user ? (user.admin === 1 ? <Databases/> : <Home/>) : <Login/>}/>

      </Route>
    </Routes>
  </BrowserRouter> 
  
}

export default App
