import React, { useEffect, useContext, useState } from "react";
import { AppContext } from "../../Context/AppContext";
import { Sidebar, Menu, MenuItem } from "react-pro-sidebar";
import { Link } from "react-router-dom";
import { BorderAllRounded } from "@mui/icons-material";

export default function AdminControlPanel() {
    const { user, appAddress, token } = useContext(AppContext);

    // State for template history
    const [templateHistory, setTemplateHistory] = useState([]);

    // State for export history
    const [exportHistory, setExportHistory] = useState([]);

    // state for user list
    const [users, setUsers] = useState([]);

    const [editUserId, setEditUserId] = useState(null);
    

    useEffect(() => {
        document.title = "Admin Control Panel - Porter";

        // Fetch template history data for all templates (admin only)
        async function fetchAllTemplateHistory() {
            try {
                const response = await fetch(
                    `${appAddress}/api/templates/history`,
                    {
                        method: "GET",
                    },
                );
                const data = await response.json();
                setTemplateHistory(data);
            } catch (error) {
                console.error("Error fetching template history:", error);
            }
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

        if (user && user.admin === 1) {
            fetchAllTemplateHistory();
            fetchUsers();
            fetchExportHistory();
        }
    }, [user, appAddress, token]);

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
                                    <tr key={log.id}>
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
                        <ul>
                            {users.map((user) => (
                                <li key={user.id}>
                                    {editUserId === user.id ? (
                                        <>
                                            <span>ID: {user.id}</span>
                                            <input type="text" defaultValue={user.name} />
                                            <input type="text" defaultValue={user.email} />
                                            <input type="checkbox" defaultChecked={user.admin} /> Admin <br />
                                            <input type="text" defaultValue={user.access} />
                                        </>
                                    ) : (
                                        <>
                                            <span>ID: {user.id}</span> <br />
                                            <span>{user.name}</span> <br />
                                            <span>{user.email}</span> <br />
                                            <span>{user.admin}</span> <br />
                                            <span>{user.access}</span> <br /> {/* change this to be a selection of databases, adding one allows the users to see and interact with it
                                                                                    maybe something else as well later on*/}
                                        </>
                                    )}
                                    <button
                                        key={`edit-${user.id}`}
                                        className="edit-button"
                                        onClick={() => {
                                            setEditUserId((prev) =>
                                                prev === user.id ? null : user.id
                                            );
                                        }}
                                    >
                                        <img
                                            src="public\icons\pencil.png"
                                            style={{ maxHeight: "20px" }}
                                        />
                                    </button>
                                    {editUserId === user.id && (
                                        <>
                                            <button className="save-button" onClick={() => setEditUserId(0)}>Save</button> {/* implement save functionality later, for now just closes edit mode */}
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </>
    );
}
