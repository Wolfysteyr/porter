import { useContext, useState } from "react"
import { AppContext } from "../Context/AppContext"
import App from "../App"
import {Link, useNavigate} from "react-router-dom"

export default function Home(){

    const navigate = useNavigate();
    const {token, user} = useContext(AppContext);

    return(
        <>
            
            {user ? (
                <div className="main-div">
                    <h2 className="title">Welcome, {user.name}</h2>
                    <h3 style={{textAlign: "center"}}>Select your action</h3>

                    {/* <Link to="/db" className="button">Database Data</Link> */}
                    <button onClick={() => navigate('/db')}>Database Data</button>
                </div>
            ) : 
                <h2 className="title">Please log in to continue.</h2>
            }
        
        
    </>)
    
}