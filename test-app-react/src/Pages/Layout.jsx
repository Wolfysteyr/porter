import { useContext } from "react";
import {Link, Outlet, useNavigate} from "react-router-dom";
import { AppContext } from "../Context/AppContext";

export default function Layout(){

    const {user, token, setUser, setToken} = useContext(AppContext);
    const navigate = useNavigate();

    async function handleLogout(e){
        e.preventDefault();

        const res = await fetch('/api/logout', {
            method: 'post',
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        });

        const data = await res.json();
        console.log(data);

        if (res.ok){
            setUser(null);
            setToken(null);
            localStorage.removeItem('token');
            navigate('/')
        }


    }

    return (
        <>
            <header>
                <nav>
                    <div>
                    <Link to="/" className="nav-link">Home</Link>
                    </div>
                    {user ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <p>
                                {user.name}
                            </p>
                                <button onClick={handleLogout}className="nav-link">Logout</button>
                        </div> 
                    ) : (
                        <div>
                        <Link to="/register" className="nav-link">Register</Link>
                        <Link to="/login" className="nav-link">Login</Link>
                        </div>
                    )
                    }
                </nav>
            </header>

            <main>
                <Outlet/>
            </main>

            <footer>
                <p>Copyright© Maksims Carevs, VTL. No rights reserved</p>
            </footer>
        </>
    );
}