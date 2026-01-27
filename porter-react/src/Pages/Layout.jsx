import { useContext, useState } from "react";
import {Link, Outlet, useNavigate} from "react-router-dom";
import { AppContext } from "../Context/AppContext";


export default function Layout(){

    const {user, token, setUser, setToken} = useContext(AppContext);
    const navigate = useNavigate();
    const [menuVisible, setMenuVisible] = useState(0);

    async function handleLogout(e){
        e.preventDefault();

        toggleMenu();
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

    function toggleMenu(){
        if (menuVisible === 1){
            setMenuVisible(2);
        } else {
            setMenuVisible(1);
        }
    }

    return (
        <>
            <header>
                <nav>
                    <div>
                    <Link to="/" className="nav-link">Home</Link>
                    {user && 
                    <>
                        <Link to="/tqb" className="nav-link">Table Query Builder</Link>
                        <Link to="/templates" className="nav-link">Templates</Link>
                    </>
                    }
                    </div>
                    {user ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <p>
                                {user.name}
                                {user.admin === 1 && 
                            ( <>
                                <br />
                                <span style={{ fontSize: '0.7rem', color: '#ddddddff', backgroundColor: '#4d4d4dff', border: '1px solid #999999ff', padding: '0.2em 0.4em', borderRadius: '0.5em' }}>Admin</span>
                            </>)}
                            </p>
                            <div className={`bars ${menuVisible === 1 ? 'active' : ''}`} onClick={toggleMenu}>
                                     <div className="bar1"></div>
                                    <div className="bar2"></div>
                                    <div className="bar3"></div>
                                </div>
                            <div className={`logout-container ${menuVisible === 1 ? 'active' : menuVisible === 2 ? 'closing' : ''}`}>
                                {user.admin === 1 && <Link to="/register" onClick={toggleMenu} className="nav-link">Register a new account</Link>} <br /> <br />
                                <Link className="nav-link" onClick={handleLogout} style={{ cursor: 'pointer' }}>Logout</Link>
                            </div>
                        </div> 
                    ) : (
                        <div>
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