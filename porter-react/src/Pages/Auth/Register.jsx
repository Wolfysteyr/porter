import {useContext, useState} from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../Context/AppContext';

export default function Register(){

    const {token, setToken} = useContext(AppContext);
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        password_confirmation: ''
    });



    const [errors, setErrors] = useState({})

    async function handleRegister(e){
        e.preventDefault();

        const res = await fetch('/api/register', {
            method:"post",
            headers:{
                Accept: 'application/json',
                "Content-Type": 'application/json',
            },
            body: JSON.stringify(formData),
            
        });
        const data = await res.json();


        if (data.errors){
            setErrors(data.errors);
        } else {
            console.log(data);
            console.log(data.token.plainTextToken);

            localStorage.setItem('token', data.token.plainTextToken);
            setToken(data.token.plainTextToken);
            setErrors("");
            setFormData({
                name: '',
                email: '',
                password: '',
                password_confirmation: ''
            });

            setTimeout(() => {
                navigate("/");
            }, 3000);
        }

        
    }

    return (
        <>
            <h1 className="title">Register a new account</h1>
            {!errors && <h3 className='success-glow'>New account registered!</h3>}

            <form id="form" onSubmit={handleRegister}>
                <div>
                    <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}  placeholder="Name" className={errors.name ? "errorinput" : ""}/>
                    {errors.name && <p className='error'>{errors.name[0]}</p>}
                </div>
                <div>
                    <input type="text" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="Email" className={errors.email ? "errorinput" : ""}/>
                    {errors.email && <p className='error'>{errors.email[0]}</p>}
                </div>
                <div>
                    <input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="Password"className={errors.password ? "errorinput" : ""}/>
                    {errors.password && <p className='error'>{errors.password[0]}</p>}
                </div>
                <div>
                    <input type="password" value={formData.password_confirmation} onChange={(e) => setFormData({...formData, password_confirmation: e.target.value})} placeholder="Confirm Password" className={errors.password ? "errorinput" : ""}/>
                </div>
                <div>
                    <input type="submit" value="Register" />
                </div>
            </form>

            
        </>
    );
}