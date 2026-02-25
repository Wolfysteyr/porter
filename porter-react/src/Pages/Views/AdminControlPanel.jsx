import React, { useEffect, useContext, useState } from "react";
import { AppContext } from "../../Context/AppContext";
import { Sidebar, Menu, MenuItem } from "react-pro-sidebar";
import { Link } from "react-router-dom";
import { BorderAllRounded } from "@mui/icons-material";

export default function AdminControlPanel() {
    const { user, appAddress, token } = useContext(AppContext);

    const [editUserName, setEditUserName] = useState("");
    const [editUserEmail, setEditUserEmail] = useState("");
    const [editUserAdmin, setEditUserAdmin] = useState(false);
    const [editUserAccess, setEditUserAccess] = useState([]);

    // State for template history
    const [templateHistory, setTemplateHistory] = useState([]);

    // State for export history
    const [exportHistory, setExportHistory] = useState([]);

    // state for user list
    const [users, setUsers] = useState([]);

    const [editUserId, setEditUserId] = useState(null);

    const [databases, setDatabases] = useState([]);

    //template log history styles
    function getLogStyles(log) {
        if (log.action === "create") {
            return { backgroundColor: "#3c9b3c", border: "2px solid #c3e6cb" };
        }
        if (log.action === "update") {
            return { backgroundColor: "#46c8fc", border: "2px solid #ffeeba" };
        }
        if (log.action === "delete") {
            return { backgroundColor: "#f55454", border: "2px solid #f5c6cb" };
        }
    };

    useEffect(() => {
        document.title = "Admin Control Panel - Porter";

        // Fetch template history data for all templates (admin only)
        async function fetchAllTemplateHistory() {
            try {
                const response = await fetch(
                    `${appAddress}/api/templates/history`,
                    {
                        method: "GET",
                        headers:{
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        credentials: "include",
                    },
                    
                );
                const data = await response.json();
                setTemplateHistory(data);
            } catch (error) {
                console.error("Error fetching template history:", error);}
        }

        async function fetchUsers() {
            try {
                const response = await fetch(`${appAddress}/api/users`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    credentials: "include",
                });
                if (response.ok) {
                    const data = await response.json();
                    setUsers(data);
                }
            } catch (error) {
                console.error("Error fetching users:", error);
            }
        }

        async function fetchExportHistory() {
            try {
                const response = await fetch(
                    `${appAddress}/api/export/history`,
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        credentials: "include",
                    },
                );
                if (response.ok) {
                    const data = await response.json();
                    setExportHistory(data);
                }
            } catch (error) {
                console.error("Error fetching export history:", error);
            }
        }

        async function fetchDatabases() {
            try {
                const response = await fetch(
                    `${appAddress}/api/databases/external`,
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        credentials: "include",
                    },
                );
                if (response.ok) {
                    const data = await response.json();
                    setDatabases(data);
                }
            } catch (error) {
                console.error("Error fetching databases:", error);
            }
        }
        fetchDatabases();

        if (user && user.admin === 1) {
            fetchAllTemplateHistory();
            fetchUsers();
            fetchExportHistory();
        }
    }, [user, appAddress, token]);

    // function to handle saving user changes when pressing save button
    async function handleSaveUser(userId) {
        // compile payload of changes, only including fields that have been changed
        const payload = {};
        
        if (editUserName && editUserName !== "") payload.name = editUserName;
        if (editUserEmail && editUserEmail !== "") payload.email = editUserEmail;
        if (editUserAdmin !== user.admin) payload.admin = editUserAdmin;
        if (editUserAccess.length > 0 || (user.access && editUserAccess.length === 0)) {
            payload.access = editUserAccess;
        }

        // Don't send empty payload
        if (Object.keys(payload).length === 0) {
            console.log("No changes to save");
            return;
        }

        try{
            console.log("payload being sent to server:", payload, "for user ID:", userId);
            const response = await fetch(`${appAddress}/api/users/${userId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            if(response.ok){
                // update user in local state to reflect changes
                setUsers((prevUsers) => prevUsers.map((u) => u.id === userId ? { ...u, ...payload } : u));
                setEditUserId(null); // exit edit mode
            } else {
                console.error("Error saving user changes:", response.statusText);
            }
        } catch (error) {
            console.error("Error saving user changes:", error);    
        } finally {
            // reset edit states
            setEditUserName("");
            setEditUserEmail("");
            setEditUserAdmin(false);
            setEditUserAccess([]);
            setEditUserId(null);
        }
    }

    return (
        <>
            <Link to="/">Home</Link>
            <h1 style={{ textAlign: "center" }}>Admin Control Panel</h1>

            <div className="main-div">
                <p>
                    Welcome to the Admin Control Panel. Here you can manage
                    users, view system logs, and perform administrative tasks.
                </p>
                <div style={{ display: "flex", gap: "10px" }}>
                    <div className="template-logs">
                        temp logs
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Template ID</th>
                                    <th>Action</th>
                                    <th>User ID</th>
                                    <th>Snapshot</th>
                                    <th>Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {templateHistory.map((log) => (
                                    <tr key={log.id} style={getLogStyles(log)}>
                                        <td>{log.id}</td>
                                        <td>{log.template_id}</td>
                                        <td>{log.action}</td>
                                        <td>{log.committed_by}</td>
                                        <td>
                                            <pre>
                                                {JSON.stringify(
                                                    log.snapshot,
                                                    null,
                                                    2,
                                                )}
                                            </pre>
                                        </td>
                                        <td>
                                            {new Date(
                                                log.created_at,
                                            ).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="export-logs">
                        export logs
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Template ID</th>
                                    <th>Export Type</th>
                                    <th>Path</th>
                                    <th>Message</th>
                                    <th>Exported At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {exportHistory.map((log) => (
                                    <tr
                                        key={log.id}
                                        style={
                                            log.message === "success"
                                                ? {
                                                      backgroundColor:
                                                          "#3c9b3c",
                                                      border: "2px solid #2e7d2e",
                                                  }
                                                : {
                                                      backgroundColor:
                                                          "#f55454",
                                                      border: "2px solid #c0392b",
                                                  }
                                        }
                                    >
                                        <td>{log.id}</td>
                                        <td>{log.template_id}</td>
                                        <td>{log.export_type}</td>
                                        {log.export_type === "database" ? (
                                            <td>
                                                {log.target_database}{" "}
                                                <p>{`->`}</p> {log.target_table}
                                            </td>
                                        ) : (
                                            <td>{log.file_path}</td>
                                        )}
                                        <td>
                                            <p
                                                style={{
                                                    overflow: "hidden",
                                                    maxWidth: "150px",
                                                }}
                                            >
                                                {log.message}
                                            </p>
                                        </td>
                                        <td>
                                            {new Date(
                                                log.created_at,
                                            ).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <br />
                    <div className="users">
                        users
                        <div>
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    style={{
                                        display: "flex",
                                        flexDirection:
                                            editUserId === user.id
                                                ? "column"
                                                : "row",
                                        gap: "1rem",
                                        paddingBottom: "1rem",
                                        justifyContent: "space-between",
                                        alignItems:
                                            editUserId === user.id
                                                ? "flex-start"
                                                : "center",
                                        borderBottom: "1px solid black",
                                        
                                    }}
                                >
                                    {editUserId === user.id ? (
                                        <>
                                            <span>ID: {user.id}</span>
                                            <input type="text" defaultValue={user.name} onChange={(e) => setEditUserName(e.target.value)} />
                                            <input type="text" defaultValue={user.email} onChange={(e) => setEditUserEmail(e.target.value)} />
                                            <input type="checkbox" defaultChecked={user.admin} onChange={(e) => setEditUserAdmin(e.target.checked)} /> Admin <br />
                                            {databases.map((db) => {
                                                const isChecked = editUserAccess.includes(db.id);
                                                
                                                return (
                                                    <div key={db.id}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setEditUserAccess((prev) => [...prev, db.id]);
                                                                } else {
                                                                    setEditUserAccess((prev) => prev.filter((id) => id !== db.id));
                                                                }
                                                            }} 
                                                        /> 
                                                        {db.name} <br />
                                                    </div>
                                                );
                                            })}
                                        </>
                                    ) : (
                                        <>
                                            <span>ID: {user.id}</span> <br />
                                            <span>{user.name}</span> <br />
                                            <span>{user.email}</span> <br />
                                            <span>{user.admin}</span> <br />
                                            {(() => {
                                                const accessArray = Array.isArray(user.access) ? user.access : (typeof user.access === 'string' ? JSON.parse(user.access) : []);
                                                return accessArray.length > 0 ? (
                                                    <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                                                        {accessArray.map((dbId) => {
                                                            const db = databases.find((d) => d.id === dbId);
                                                            return <li key={dbId}>{db ? db.name : `Database ID ${dbId}`}</li>;
                                                        })}
                                                    </ul>
                                                ) : 'No database access';
                                            })()} <br />
                                             {/* change this to be a selection of databases, adding one allows the users to see and interact with it
                                                                                    maybe something else as well later on*/}
                                        </>
                                    )}
                                    <button
                                        key={`edit-${user.id}`}
                                        className={editUserId === user.id ? "delete-button" : "edit-button"}
                                        onClick={() => {
                                            setEditUserId((prev) =>
                                                prev === user.id ? null : user.id
                                            );

                                            setEditUserAccess(Array.isArray(user.access) ? user.access : (typeof user.access === 'string' ? JSON.parse(user.access) : [])); // set access state to current user access when entering edit mode
                                            setEditUserAdmin(user.admin); // set admin state to current user admin when entering edit mode
                                            setEditUserEmail(user.email); // set email state to current user email when entering edit mode
                                            setEditUserName(user.name); // set name state to current user name when entering edit mode
                                        }}
                                    >
                                        <img
                                            src={editUserId === user.id ? "/icons/close.png" : "/icons/pencil.png"}
                                            style={{ maxHeight: "20px" }}
                                        />
                                    </button>
                                    {editUserId === user.id && (
                                        <>
                                            <button className="save-button" onClick={() => handleSaveUser(user.id)}>Save</button> {/* implement save functionality later, for now just closes edit mode */}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
