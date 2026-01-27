import { useContext } from "react"
import { AppContext } from "../Context/AppContext"
import App from "../App"
import {Link, useNavigate} from "react-router-dom"
import { useEffect } from "react"

export default function Home(){

    const navigate = useNavigate();
    const {user} = useContext(AppContext);

    useEffect(() => {
            document.title = 'Porter';
        }, []);

    return(
        <>
            
            {user ? (
                <div className="main-div">
                    <h2 className="title">Welcome, {user.name}</h2>
                    <h3 style={{textAlign: "center"}}>Select your action</h3>

                    {/* <Link to="/db" className="button">Database Data</Link> */}
                    <button onClick={() => navigate('/tqb')}>Table Query Builder</button> <br /> <br />
                    <button onClick={() => navigate('/templates')}> Query Templates</button> <br /> <br />
                    {user.admin ? <><button onClick={() => navigate('/databases')}> Databases</button>   <br /> <br /></> : null}
                </div>
            ) : 
                <h2 className="title">Please log in to continue.</h2>
            }
        
        
    </>)
    
}