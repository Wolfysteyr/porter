import React, { useContext, useEffect, useState } from "react";
import Modal from "react-modal";
import { AppContext } from "../../Context/AppContext";
Modal.setAppElement("#root");

export default function Databases() {
    const { appAddress, token } = useContext(AppContext);

    const [databases, setDatabases] = useState([]);

    // Delete modal state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [dbToDelete, setDbToDelete] = useState(null);

    // Edit modal state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editDatabase, setEditDatabase] = useState("");
    const [editDriver, setEditDriver] = useState("mysql");
    const [editHost, setEditHost] = useState("localhost");
    const [editPort, setEditPort] = useState("3306");
    const [editUsername, setEditUsername] = useState("");
    const [editPassword, setEditPassword] = useState("");
    const [editDescription, setEditDescription] = useState("");

    // Message modal
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [messageSuccess, setMessageSuccess] = useState(true);

    // Loading modal state
    const [loading, toggleLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState("");
    



    // Fetch databases

    const fetchDatabasesCb = React.useCallback(
        async function fetchDatabases() {
            if (!token) return;
            try {
                const res = await fetch(
                    `${appAddress}/api/databases/external`,
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: "application/json",
                        },
                    },
                );
                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(txt || `Status ${res.status}`);
                }
                const data = await res.json();
                setDatabases(Array.isArray(data) ? data : (data.data ?? []));
            } catch (err) {
                console.error("fetchDatabases err", err);
            } finally {
                toggleLoading(false);
            }
        },
        [appAddress, token],
    );

    useEffect(() => {
        fetchDatabasesCb();
        document.title = "Porter - Databases";
    }, [fetchDatabasesCb]);

    // Create-modal state + new DB fields
    const [toggleNewDBModal, setToggleNewDBModal] = useState(false);
    const [newDBName, setNewDBName] = useState("");
    const [newDBDescription, setNewDBDescription] = useState("");
    const [newDBDriver, setNewDBDriver] = useState("mysql");
    const [newDBHost, setNewDBHost] = useState("");
    const [newDBPort, setNewDBPort] = useState("3306");
    const [newDBUsername, setNewDBUsername] = useState("");
    const [newDBPassword, setNewDBPassword] = useState("");

    function openCreateModal() {
        setToggleNewDBModal(true);
    }

    async function handleCreateNewDatabase() {
        if (!token) return;
        const payload = {
            name: newDBName,
            description: newDBDescription || "",
            driver: newDBDriver || "mysql",
            host: newDBHost || "localhost",
            port: newDBPort || "3306",
            username: newDBUsername || "",
            password: newDBPassword || "",
        };
        try {
            const res = await fetch(`${appAddress}/api/databases/external`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                const err =
                    data?.error || data?.message || "Failed to create database";
                throw new Error(err);
            }
            openMessageModal("Database created", true);
            setToggleNewDBModal(false);
            // refresh list
            fetchDatabasesCb();
        } catch (err) {
            console.error("create db err", err);
            openMessageModal(err.message || "Failed to create database", false);
        }
    }

    function openMessageModal(msg, success = true) {
        setMessage(msg);
        setMessageSuccess(success);
        setIsMessageModalOpen(true);
        setTimeout(() => setIsMessageModalOpen(false), 3000);
    }

    function openDeleteModal(db) {
        setDbToDelete(db);
        setIsDeleteModalOpen(true);
    }

    function closeDeleteModal() {
        setDbToDelete(null);
        setIsDeleteModalOpen(false);
    }

    async function confirmDelete() {
        if (!dbToDelete || !token) return;
        try {
            const res = await fetch(
                `${appAddress}/api/databases/external/${dbToDelete.id}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                    },
                },
            );
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || `Status ${res.status}`);
            }
            openMessageModal("Database deleted", true);
            closeDeleteModal();
            fetchDatabasesCb();
        } catch (err) {
            console.error("delete err", err);
            openMessageModal("Failed to delete database", false);
        }
    }

    function openEditModal(db) {
        setEditId(db.id);
        setEditName(db.name ?? "");
        // The model stores database name in 'database' or 'name' depending on convention
        setEditDatabase(db.database ?? db.name ?? "");
        setEditDriver(db.driver ?? "mysql");
        setEditHost(db.host ?? "localhost");
        setEditPort(db.port ?? "3306");
        setEditUsername(db.username ?? "");
        setEditPassword(db.password ?? "");
        setEditDescription(db.description ?? "");
        setIsEditModalOpen(true);
    }

    function closeEditModal() {
        setIsEditModalOpen(false);
        setEditId(null);
    }

    async function handleSaveEditedDb() {
        if (!editId || !token) return;
        const payload = {
            name: editName,
            description: editDescription,
            driver: editDriver,
            host: editHost,
            port: editPort,
            username: editUsername,
            password: editPassword,
        };
        try {
            const res = await fetch(
                `${appAddress}/api/databases/external/${editId}`,
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify(payload),
                },
            );
            const data = await res.json();
            if (!res.ok) {
                const errMsg = data?.error || data?.message || "Failed to save";
                throw new Error(errMsg);
            }
            openMessageModal("Saved changes", true);
            closeEditModal();
            fetchDatabasesCb();
        } catch (err) {
            console.error("saveEditedDb err", err);
            openMessageModal(err.message || "Failed to save changes", false);
        }
    }

    function handleDBImage(driver) {
        switch (driver) {
            case "mysql":
                return "/public/db_images/mysql.png";
            case "postgresql":
                return "/public/db_images/postgresql.png";
            case "sqlite":
                return "/public/db_images/sqlite.png";
            case "sqlsrv":
                return "/public/db_images/sqlserver.png";
            case "mariadb":
                return "/public/db_images/mariadb.png";
            case "oracle":
                return "/public/db_images/oracle.png";
            default:
                return "/public/db_images/mysql.png";
        }
    }

    return (
        <>
            <div className="title-row">
                <h1 className="title">External Databases</h1>
                <button onClick={openCreateModal} className="create-button">
                    <strong>+</strong> New
                </button>
            </div>
            <div className="main-div">
                {databases.length === 0 ? (
                    <p>No external databases configured.</p>
                ) : (
                    <>
                        <div className="db-grid">
                            {databases.map((db) => (
                                <div key={db.id} className="db-card">
                                    <div className="card-buttons">
                                        <button
                                            onClick={() => openEditModal(db)}
                                            className="edit-button"
                                            title="Edit Database"
                                        >
                                            <img
                                                src="/public/icons/pencil.png"
                                                alt="Edit"
                                                style={{ maxWidth: "20px" }}
                                            />
                                        </button>
                                        <button
                                            onClick={() => openDeleteModal(db)}
                                            className="delete-button"
                                            title="Delete Database"
                                        >
                                            <img
                                                src="/public/icons/close.png"
                                                alt="Delete"
                                                style={{ maxWidth: "20px" }}
                                            />
                                        </button>
                                    </div>
                                    <hr />
                                    <div className="db-img">
                                        <img
                                            src={handleDBImage(db.driver)}
                                            alt={db.driver}
                                            style={{
                                                maxWidth: "200px",
                                                minWidth: "50px",
                                            }}
                                        />
                                    </div>
                                    <hr />

                                    <div className="db-info">
                                        <span>
                                            <h2>{db.name}</h2>
                                        </span>
                                        <p>{db.description}</p>
                                        <strong>
                                            {db.host} : {db.port}
                                        </strong>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Message modal */}
            <Modal
                isOpen={isMessageModalOpen}
                onRequestClose={() => setIsMessageModalOpen(false)}
                contentLabel="Message"
                className={`message-modal ${
                    messageSuccess ? "success" : "error"
                }`}
                overlayClassName="none"
            >
                <div style={{ padding: "1rem" }}>
                    <p>{message}</p>
                </div>
            </Modal>

            {/* New Database modal */}
            <Modal
                isOpen={toggleNewDBModal}
                onRequestClose={() => setToggleNewDBModal(false)}
                contentLabel="Create New Database"
                overlayClassName={"modal-overlay"}
                className={"newDB-modal"}
            >
                <h2>Create New Database</h2>
                <input
                    type="text"
                    placeholder="Database Name"
                    onChange={(e) => setNewDBName(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Description"
                    onChange={(e) => setNewDBDescription(e.target.value)}
                />{" "}
                {/* custom description to help identify the database */}
                <select
                    name="driver"
                    id="driver"
                    onChange={(e) => setNewDBDriver(e.target.value)}
                >
                    <option value="mysql">MySQL</option>
                    <option value="pgsql">PostgreSQL</option>
                    <option value="mariadb">MariaDB</option>
                    <option value="sqlsrv">SQL Server</option>
                    <option value="sqlite">SQLite</option>
                    <option value="oracle">Oracle</option>
                </select>
                <input
                    type="text"
                    placeholder="Host (default: localhost)"
                    onChange={(e) => setNewDBHost(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Port (default: 3306)"
                    onChange={(e) => setNewDBPort(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Username"
                    onChange={(e) => setNewDBUsername(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Password"
                    onChange={(e) => setNewDBPassword(e.target.value)}
                />
                <br />
                <button
                    className="use-button"
                    onClick={() => {
                        handleCreateNewDatabase();
                    }}
                >
                    Create
                </button>
                <button
                    className="delete-button"
                    onClick={() => setToggleNewDBModal(false)}
                >
                    Cancel
                </button>
            </Modal>

            {/* Delete confirmation modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onRequestClose={closeDeleteModal}
                contentLabel="Confirm Delete"
                className="delete-modal"
                overlayClassName="modal-overlay"
            >
                <div style={{ padding: "1rem" }}>
                    <h2>Confirm Delete</h2>
                    <p>
                        Are you sure you want to delete the external database "
                        {dbToDelete?.name}"?
                    </p>
                    <div
                        style={{
                            display: "flex",
                            gap: "0.5rem",
                            marginTop: "1rem",
                        }}
                    >
                        <button
                            onClick={confirmDelete}
                            className="delete-button"
                        >
                            Delete
                        </button>
                        <button
                            onClick={closeDeleteModal}
                            className="edit-button"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Edit modal */}
            <Modal
                isOpen={isEditModalOpen}
                onRequestClose={closeEditModal}
                contentLabel="Edit Database"
                className="newDB-modal"
                overlayClassName="modal-overlay"
            >
                <h2>Edit database</h2>
                <input
                    type="text"
                    placeholder="Database Name"
                    value={editDatabase}
                    onChange={(e) => setEditDatabase(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                />{" "}
                {/* custom description to help identify the database */}
                <select
                    name="driver"
                    id="driver"
                    value={editDriver}
                    onChange={(e) => setEditDriver(e.target.value)}
                >
                    <option value="mysql">MySQL</option>
                    <option value="pgsql">PostgreSQL</option>
                    <option value="mariadb">MariaDB</option>
                    <option value="sqlsrv">SQL Server</option>
                    <option value="sqlite">SQLite</option>
                    <option value="oracle">Oracle</option>
                </select>
                <input
                    type="text"
                    placeholder="Host (default: localhost)"
                    value={editHost}
                    onChange={(e) => setEditHost(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Port (default: 3306)"
                    value={editPort}
                    onChange={(e) => setEditPort(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Username"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                />
                <br />
                <button
                    className="use-button"
                    onClick={() => {
                        handleSaveEditedDb();
                    }}
                >
                    Create
                </button>
                <button
                    className="delete-button"
                    onClick={() => closeEditModal()}
                >
                    Cancel
                </button>
            </Modal>

            {/* Loading modal */}
            <Modal
                        isOpen={loading}
                        contentLabel="Loading"
                        overlayClassName={"modal-overlay"}
                        className={"loading-modal"}
                    >
                        <p>{loadingMessage || "Loading, please wait..."}</p>
                        <div className="loader"></div>
            </Modal>
        </>
    );
}
