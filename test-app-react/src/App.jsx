import {BrowserRouter, Routes, Route} from "react-router-dom";
import Home from "./Pages/Home";
import Layout from "./Pages/Layout";
import Login from "./Pages/Auth/Login";
import Register from "./Pages/Auth/Register.jsx";

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
        <Route path="/register" element={ user ? <Home/> : <Register/>}/>
        

      </Route>
    </Routes>
  </BrowserRouter> 
  
}

export default App
