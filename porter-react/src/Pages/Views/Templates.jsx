import React, { use } from "react";
import { AppContext } from "../../Context/AppContext";
import { useContext } from "react";
import { useState, useEffect } from "react";
import Modal from "react-modal";
import { useNavigate, useLocation} from "react-router-dom";
import TemplateSideMenu from "../../Components/TemplateSideMenu";
import { useQueryBuilder } from "../../hooks/useQueryBuilder";
export default function Templates() {
    // Context and global state
    const { appAddress, user, token } = useContext(AppContext);
    const navigate = useNavigate();
    const location = useLocation();
    const { databases, setDatabases } = useState([]);

    // Templates state
    const [templates, setTemplates] = useState([]);

    // Loading modal state
    const [loading, toggleLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");

    // Message modal state
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [messageSuccess, setMessageSuccess] = useState(true);

    // Delete modal state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState(null);

    // Edit modal state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [activeTemplate, setActiveTemplate] = useState(null);
    const [editShowSuccessGlow, setEditShowSuccessGlow] = useState(false);

    // Only create the hook for the active template when editing
    const qb = useQueryBuilder({
        appAddress,
        token,
        user,
        navigate,
        template: activeTemplate || {},
        closeEditModal: () => setIsEditModalOpen(false),
    });



    // ensure databases are loaded for the side menu when editing
    useEffect(() => {
        if (isEditModalOpen && token) {
            qb.getDatabases();
        }
    }, [isEditModalOpen, token, appAddress]);

    async function fetchTemplates() {
        try {
            const response = await fetch(`${appAddress}/api/query-templates`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                },
            });
            const data = await response.json();
            setTemplates(data);
        } catch (e) {
            setTemplates([]);
        }
    }

    // Fetch templates from API
    useEffect(() => {
        fetchTemplates();
    }, [appAddress, token]);

    // raise updatedData flag when relevant query builder state changes
     useEffect(() => {
        qb.setUpdatedData(true);
    }, [qb.selectedCols, qb.foreignKeysSelection, qb.selectedWhere, qb.rowLimit]);

    // Fetch databases for side menu
    useEffect(() => {
        async function fetchDatabases() {
            try {
                const response = await fetch(`${appAddress}/api/databases`, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                    },
                });
                const data = await response.json();
                setDatabases(data);
            } catch (e) {
                setDatabases([]);
            }
        }
        fetchDatabases();
    }, [appAddress, token]);

    // show redirected message if any
    useEffect(() => {
        const state = location?.state;
        if (state?.message) {
            openMessageModal(state.message);

            window.history.replaceState({}, document.title);

        }
    }, [location.state]);

    // toggle loading modal when fetching table data
    useEffect(() => {
        toggleLoading(qb.loading);
    }, [qb.loading]);


    // Open edit modal for editing a template
    function openEditModal(template) {
        setActiveTemplate(template);
        setIsEditModalOpen(true);
        qb.handleFetchTableData(template.table);
    }

    function closeEditModal() {
        setIsEditModalOpen(false);
        setActiveTemplate(null);
        fetchTemplates();
        
    }

    // open modal instead of calling window.confirm directly
    function openDeleteModal(template) {
        setTemplateToDelete(template);
        setIsDeleteModalOpen(true);
    }

    function closeDeleteModal() {
        setTemplateToDelete(null);
        setIsDeleteModalOpen(false);
    }

    function openMessageModal(msg, success = true) {
        setMessage(msg);
        setMessageSuccess(success);
        setIsMessageModalOpen(true);
        setTimeout(() => {
            setIsMessageModalOpen(false);
        }, 3000);
    }

    // perform the actual delete when user confirms in modal
    async function confirmDelete() {
        if (!templateToDelete) return;

        const id = templateToDelete.id;
        const response = await fetch(
            `${appAddress}/api/query-templates/${id}`,
            {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                },
            },
        );

        if (response.ok) {
            setTemplates(templates.filter((template) => template.id !== id));
        } else {
            console.error("Failed to delete template");
        }
        setMessageSuccess(true);
        openMessageModal(
            `Template "${templateToDelete.name}" deleted successfully`,
        );
        closeDeleteModal();
    }

    // placeholder edit handler (keep or implement)
    function handleEdit(id) {
        const t = templates.find((x) => x.id === id);
        if (!t) return;
        openEditModal(t);
    }

    async function handleUseTemplate(template) {
        // navigate('/export', { state: { template } });
        console.log("Using template:", template);
        try {
            toggleLoading(true);
            console.log("payload for export", template);
            setTimeout(() => {
                if (loading) {
                    setLoadingMessage(
                        "That's a lot of data! This may take a while...",
                    );
                }
            }, 5000);
            const response = await fetch(`${appAddress}/api/export`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(template),
            });

            if (!response.ok) {
                console.error("Export failed with status:", response.status);
                throw new Error("Failed to export data");
            }
            if (!template.export.exportType) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${template.name}_export.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                navigate("/templates", {
                    state: {
                        message: `Export successful! Exported to ${template.name + "_export.csv"}`,
                    },
                });
            } else {
                const blob = await response.json();
                navigate("/templates", {
                    state: {
                        message: `Export successful! Exported to  ${template.export.targetDatabase}, table ${template.export.targetTable}. ${blob.total_inserted} rows inserted, ${blob.total_skipped} rows skipped.`,
                    },
                });
            }
        } catch (error) {
            console.error("Error exporting data:", error);
            alert("Error exporting data. Please try again later.");
        } finally {
            toggleLoading(false);
        }
    }

    // Templates visible to current user (admins see all)
    const visibleTemplates = templates.filter(
        (t) => user?.admin === 1 || t.user_id === user?.id,
    );

    return (
        <>
            <h1 className="title">Query Templates</h1>
            <div className="main-div">
                {visibleTemplates.length === 0 ? (
                    <p>No templates found.</p>
                ) : (
                    <ul className="template-list">
                        {/* header row for columns */}
                        <li
                            className="template-item template-header"
                            key="header"
                            style={{
                                fontWeight: 700,
                                background: "transparent",
                                border: "none",
                                cursor: "default",
                                maxHeight: "none",
                            }}
                        >
                            <span className="template-name">Name</span>
                            <span className="template-db">Database</span>
                            <span className="template-table">Table</span>
                            <span
                                className="template-created-at"
                                style={{ minWidth: "120px" }}
                            >
                                Created at
                            </span>
                            <span
                                className="template-updated-at"
                                style={{ minWidth: "140px" }}
                            >
                                Last Updated
                            </span>
                            <span className="template-actions">Actions</span>
                        </li>
                        {visibleTemplates.map((template) => (
                            <li className="template-item" key={template.id}>
                                <span className="template-name">
                                    {template.name}
                                </span>
                                <span className="template-db">
                                    {template.database}
                                </span>
                                <span className="template-table">
                                    {template.table}
                                </span>
                                <span className="template-created-at">
                                    {new Date(
                                        template.created_at,
                                    ).toLocaleDateString()}
                                </span>
                                <span className="template-updated-at">
                                    {new Date(
                                        template.updated_at,
                                    ).toLocaleDateString()}
                                </span>
                                <div className="template-actions">
                                    <button
                                        onClick={() =>
                                            handleUseTemplate(template)
                                        }
                                        title="Click to use template"
                                        className="use-button"
                                    >
                                        Use
                                    </button>
                                    <button
                                        onClick={() => handleEdit(template.id)}
                                        title="Click to edit template"
                                        className="edit-button"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() =>
                                            openDeleteModal(template)
                                        }
                                        title="Click to delete template"
                                        className="delete-button"
                                    >
                                        X
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Message modal */}
            <Modal
                isOpen={isMessageModalOpen}
                onRequestClose={isMessageModalOpen}
                contentLabel="Message"
                className={`message-modal ${messageSuccess ? "success" : "error"}`}
                overlayClassName="none"
            >
                <div style={{ padding: "1rem" }}>
                    <p>{message}</p>
                </div>
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
                        Are you sure you want to delete the template "
                        {templateToDelete?.name}"?
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

            {/* Template side menu */}

            {/* Edit template modal */}
            <Modal
                isOpen={isEditModalOpen}
                onRequestClose={closeEditModal}
                contentLabel="Edit Template"
                className="edit-modal"
                overlayClassName="modal-overlay"
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <h2>
                        Edit Template
                        {activeTemplate ? ` - ${activeTemplate.name}` : ""}
                    </h2>
                </div>
                <div style={{ marginTop: "0.75rem" }}>
                    {activeTemplate && qb.tableData.length > 0 ? (
                        <div
                            className={`tableContainer ${qb.showSuccessGlow ? "successGlow" : ""}`}
                        >
                            <table border="1" cellPadding="5">
                                <thead>
                                    <tr>
                                        {Object.keys(qb.tableData[0]).map(
                                            (col, idx) => (
                                                <th key={idx}>{col}</th>
                                            ),
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {qb.tableData.map((row, i) => (
                                        <tr key={i}>
                                            {Object.values(row).map(
                                                (val, j) => (
                                                    <td key={j}>
                                                        {String(val)}
                                                    </td>
                                                ),
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p style={{ color: "#999" }}>
                            {activeTemplate
                                ? "No preview rows returned."
                                : "No table selected for preview."}
                        </p>
                    )}
                </div>
            </Modal>

            {isEditModalOpen && (
                <div
                    style={{
                        position: "fixed",
                        right: 0,
                        top: "30%",
                        zIndex: 1000000,
                        height: "100vh",
                        overflow: "auto",
                        pointerEvents: "auto",
                    }}
                >
                    <TemplateSideMenu
                        {...qb}
                        handleFetchTableData={qb.handleFetchTableData}
                        handleSaveTemplate={qb.handleSaveTemplate}
                        populateFindOptions={() => {}}
                        isEditing={true}
                    />
                </div>
            )}

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
