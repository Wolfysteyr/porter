import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../../Context/AppContext";

export default function Register() {
    const { token, setToken, user } = useContext(AppContext);
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        password_confirmation: "",
        admin: 0,
    });

    const [errors, setErrors] = useState({});

    // secure random password generator
    function generatePassword(length = 16) {
        const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*()-_=+"; // omit ambiguous chars
        const values = new Uint32Array(length);
        window.crypto.getRandomValues(values);
        let out = "";
        for (let i = 0; i < length; i++) {
            out += charset[values[i] % charset.length];
        }
        return out;
    }

    // password will be generated on submit if not provided

    async function handleRegister(e) {
        e.preventDefault();
        // ensure we send a password (generate a temporary one if none provided)
        const pw = formData.password && formData.password.length > 0 ? formData.password : generatePassword(16);
        const payload = { ...formData, password: pw, password_confirmation: pw };

        const res = await fetch("/api/register", {
            method: "post",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (data.errors) {
            setErrors(data.errors);
        } else {
            console.log(data);
            // If an admin (currently logged in) created this user, don't overwrite the admin's session.
            const createdToken = data?.token?.plainTextToken;
            if (user && user.admin === 1) {
                // Admin created user: do not store or set the returned token. Keep admin logged in.
                setErrors("");
                setFormData({ name: "", email: "", password: "", password_confirmation: "" });
                // Optionally navigate back to templates or stay. We'll navigate back to templates.
                setTimeout(() => {
                    navigate('/');
                }, 1000);
            } else {
                // Self-registration: store token and log the new user in as before
                if (createdToken) {
                    localStorage.setItem("token", createdToken);
                    setToken(createdToken);
                }
                setErrors("");
                setFormData({ name: "", email: "", password: "", password_confirmation: "" });
                setTimeout(() => {
                    navigate('/');
                }, 3000);
            }
        }
    }

    return (
        <>
            <h1 className="title">Register a new account</h1>
            {!errors && (
                <h3 className="success-glow">New account registered!</h3>
            )}

            <form id="form" onSubmit={handleRegister}>
                <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Name"
                    className={errors.name ? "errorinput" : ""}
                />
                {errors.name && <p className="error">{errors.name[0]}</p>}

                <input
                    type="text"
                    value={formData.email}
                    onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="Email"
                    className={errors.email ? "errorinput" : ""}
                />
                {errors.email && <p className="error">{errors.email[0]}</p>}

                {/* password is generated automatically on submit and sent in the payload */}

                <input type="checkbox" id="admin-checkbox"
                    onChange={(e) =>
                        setFormData({ ...formData, admin: e.target.checked ? 1 : 0 })
                    }
                />
                <label htmlFor="admin-checkbox">Admin</label>

                <input type="submit" value="Register" />
            </form>
        </>
    );
}
