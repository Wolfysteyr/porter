import { createContext, useEffect, useState } from "react";

export const AppContext = createContext();

export default function AppProvider({children}){

    const appAddress = import.meta.env.APP_URL || "http://localhost:8000"; // Base URL for API requests, default to localhost if not set

    // State for authentication token and user info
    const [token, setToken] = useState(localStorage.getItem('token')); // initialize token from localStorage
    const [user, setUser] = useState(null);

    // Fetch user data when token changes
    async function getUser() {
        const res = await fetch(`${appAddress}/api/user`, {
            headers:{
                "Authorization": `Bearer ${token}`,
                "Accept":"application/json"
            }
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Error ${res.status}: ${errorText}`);
        }
        const data = await res.json();
        if (res.ok){
            setUser(data);
        }    
    }

    useEffect(()=>{
        // debug, been here since forever, might as well keep it, who the hell goes into console anyway
        console.log('effect ran');
        if(token){
            getUser();
        } else {
            console.log("nothing");
        }
    }, [token]);


    return (
        <AppContext.Provider value={{token, setToken, user, setUser, appAddress}}> 
            {children} 
        </AppContext.Provider>
    );
}