import {useContext, useState} from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../Context/AppContext';

export default function Login(){

    const {token, setToken} = useContext(AppContext);
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });

    const [errors, setErrors] = useState({})

    async function handleLogin(e){
        e.preventDefault();

        const res = await fetch('/api/login', {
            method:"POST",
            headers:{
                Accept: 'application/json',
                "Content-Type": 'application/json',
            },
            body: JSON.stringify(formData),
            
        });
        const data = await res.json();
        console.log(data);

        

        if (data.errors || !data.token){
            setErrors(data.errors);
        } else {
            localStorage.setItem('token', data.token);
            setToken(data.token);
            navigate("/");

        }

        
    }

    return (
        <>
            <h1 className="title">Login</h1>

            <form id="form" onSubmit={handleLogin}>
                
                <div>
                    <input type="text" value={formData.email} 
                    onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="Email" 
                    className={errors.email ? "errorinput" : ""}/>
                    {errors.email && <p className='error'>{errors.email[0]}</p>}
                </div>
                <div>
                    <input type="password" value={formData.password} 
                    onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="Password"
                    className={errors.password ? "errorinput" : ""}/>
                    {errors.password && <p className='error'>{errors.password[0]}</p>}
                </div>

                <div>
                    <input type="submit" value="Login" />
                </div>
            </form>

            
        </>
    );
}