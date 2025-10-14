import { createContext, useEffect, useState } from "react";

export const AppContext = createContext();

export default function AppProvider({children}){

    const appAddress = import.meta.env.APP_URL || "http://localhost:8000";

    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState(null);

    async function getUser() {
        const res = await fetch('api/user', {
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
        console.log('effect ran')
        if(token){
            getUser();
        } else {
            console.log("nothing")
        }
    }, [token]);


    return (
        <AppContext.Provider value={{token, setToken, user, setUser, appAddress}}>
            {children}
        </AppContext.Provider>
    );
}