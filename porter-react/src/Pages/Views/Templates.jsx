import { AppContext } from "../../Context/AppContext";
import { useState, useEffect, useCallback, useContext } from "react";
import Modal from "react-modal";
import { useNavigate, useLocation } from "react-router-dom";
import TemplateSideMenu from "../../Components/TemplateSideMenu";
import { useQueryBuilder } from "../../hooks/useQueryBuilder";
import Tippy from "@tippyjs/react";
export default function Templates() {
    // auto run stuff
    const [autoRunSettings, setAutoRunSettings] = useState({}); // {[templateId]: {interval: ..., unit: ..., active: ...}}
    const [autoCountdowns, setAutoCountdowns] = useState({}); //
    const [updateCountdown, setUpdateCountdown] = useState(false);

    //UI
    const [toggles, setToggles] = useState({});

    // Context and global state
    const { appAddress, user, token } = useContext(AppContext);
    const navigate = useNavigate();
    const location = useLocation();

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
    // const [editShowSuccessGlow, setEditShowSuccessGlow] = useState(false);

    // update countdown every minute to avoid page refresh
   

    // countdown engine
    useEffect(() => {
        setUpdateCountdown(false);
        const timer = setInterval(() => {
            const now = Date.now();

            const updated = {};

            templates.forEach((t) => {
                const next = t.next_auto_run_at;
                const active = t.auto?.active;

                if (!active || !next) return;

                const diff = new Date(next).getTime() - now;

                updated[t.id] = diff > 0 ? diff : 0;
            });

            setAutoCountdowns(updated);
        }, 1000);

        return () => clearInterval(timer);
    }, [templates, updateCountdown]);

    function formatCountdown(ms) {
        const s = Math.floor(ms / 1000);

        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;

        return `${d}d ${h}h ${m}m ${sec}s`;
    }

    function formatDateTime(dt) {
        if (!dt) return "N/A";
        try {
            const d = new Date(dt);
            if (Number.isNaN(d.getTime())) return String(dt);
            return d.toLocaleString();
        } catch {
            return String(dt);
        }
    }

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

    useEffect(() => {
        let timeoutId;

        const scheduleFetch = () => {
            timeoutId = setTimeout(async () => {
                await fetchTemplates();
                scheduleFetch(); // Schedule the next fetch exactly 60 seconds after this one completes
            }, 60_000);
        };

        // Initial delay of 5 seconds before the first fetch
        timeoutId = setTimeout(async () => {
            await fetchTemplates();
            scheduleFetch();
        }, 15_000);

        return () => clearTimeout(timeoutId);
    }, [appAddress, token]);

    // raise updatedData flag when relevant query builder state changes
    useEffect(() => {
        qb.setUpdatedData(true);
    }, [
        qb.selectedCols,
        qb.foreignKeysSelection,
        qb.selectedWhere,
        qb.rowLimit,
    ]);

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
            } catch (e) {}
        }
        document.title = "Porter - Query Templates";
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

    // fetch template auto run settings from template
    useEffect(() => {
        const settings = {};
        templates.forEach((template) => {
            settings[template.id] = {
                schedule: template.auto.schedule ?? "every",
                interval: template.auto.interval ?? 5,
                unit: template.auto.unit ?? "minutes",
                active: template.auto.active ?? false,
            };
        });
        setAutoRunSettings(settings);
    }, [templates]);

    // handle template auto run settings changes
    const handleAutoRunSettingsChange = (templateId, settings) => {
        setAutoRunSettings((prevSettings) => ({
            ...prevSettings,
            [templateId]: {
                ...prevSettings[templateId],
                ...settings,
            },
        }));

        // debug
        console.log("Auto run settings updated:", {
            ...autoRunSettings,
            [templateId]: {
                ...autoRunSettings[templateId],
                ...settings,
            },
        });
    };

    // handle saving auto run settings to backend | reuses existing API endpoint, just updates auto field
    async function handleSaveAutoRunSettings(template) {
        if (autoRunSettings[template.id].schedule !== "every") {
            autoRunSettings[template.id].interval = null;
            autoRunSettings[template.id].unit = null;
        }
        const payload = {
            name: template.name,
            database: template.database,
            table: template.table,
            query: template.query,
            export: template.export,
            user_id: template.user_id,
            auto: {
                schedule: autoRunSettings[template.id].schedule,
                interval: autoRunSettings[template.id].interval,
                unit: autoRunSettings[template.id].unit,
                active: autoRunSettings[template.id].active,
            },
            last_auto_run_at: null,
            next_auto_run_at: null,
        };
        try {
            const response = await fetch(
                `${appAddress}/api/query-templates/${template.id}`,
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                },
            );
            if (response.ok) {
                openMessageModal("Auto run settings saved successfully");
            } else {
                openMessageModal("Failed to save auto run settings", false);
            }
        } catch (e) {
            openMessageModal("Failed to save auto run settings", false);
        }
    }
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

    // Toggle functions for UI elements
    const toggleUI = useCallback((id) => {
        setToggles((prev) => ({ ...prev, [id]: !prev[id] }));
        // debug
        console.log("Toggles after toggleUI:", {
            ...toggles,
            [id]: !toggles[id],
        });
    }, []);

    // backward compatible alias
    const isToggled = (id) => !!toggles[id];

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
                                className="template-updated-at"
                                style={{ minWidth: "140px" }}
                            >
                                Last Updated
                            </span>
                            <span className="auto-timer">Auto Run</span>
                            <span className="template-actions">Actions</span>
                        </li>
                        {visibleTemplates.map((template) => (
                            <>
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

                                    <span className="template-updated-at">
                                        {new Date(
                                            template.updated_at,
                                        ).toLocaleDateString()}
                                    </span>
                                    <span className="auto-timer">
                                        {template.auto?.active ? (
                                            <Tippy
                                            content={autoRunSettings[
                                                template.id
                                            ]?.active && (
                                                <>
                                                    <strong>Last run at:{" "} </strong><br />
                                                    {formatDateTime(
                                                        template.last_auto_run_at,
                                                    )}
                                                </>
                                            )}
                                            >
                                            <span className={autoRunSettings[template.id]?.active ? "active" : ""}>
                                                {autoCountdowns[template.id]
                                            ? formatCountdown(
                                                  autoCountdowns[template.id],
                                              )
                                            : "Paused"}
                                            </span>
                                        </Tippy>) : (
                                            "Inactive"
                                        )}
                                        
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
                                            onClick={() =>
                                                toggleUI(template.id)
                                            }
                                            title={
                                                isToggled(template.id)
                                                    ? "Close Auto Run Options"
                                                    : "Open Auto Run Options"
                                            }
                                            className="auto-button"
                                        >
                                            {isToggled(template.id)
                                                ? "Auto ▲"
                                                : "Auto ▼"}
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleEdit(template.id)
                                            }
                                            title="Click to edit template"
                                            className="edit-button"
                                        >
                                            <img
                                                src="public/icons/pencil.png"
                                                alt="Edit"
                                                style={{ maxWidth: "20px" }}
                                            />
                                        </button>
                                        <button
                                            onClick={() =>
                                                openDeleteModal(template)
                                            }
                                            title="Click to delete template"
                                            className="delete-button"
                                        >
                                            <img
                                                src="public/icons/close.png"
                                                alt="Delete"
                                                style={{ maxWidth: "20px" }}
                                            />
                                        </button>
                                    </div>
                                </li>
                                <div
                                    className={`auto-run-options ${isToggled(template.id) ? "open" : ""}`}
                                >
                                    <br />
                                    <button
                                        className="pause-resume-button"
                                        onClick={() => {
                                            handleAutoRunSettingsChange(
                                                template.id,
                                                {
                                                    active: !autoRunSettings[
                                                        template.id
                                                    ]?.active,
                                                },
                                            );
                                        }}
                                    >
                                        {autoRunSettings[template.id]?.active ? (
                                            <img
                                                src="public/icons/pause.png"
                                                alt="Pause"
                                                style={{
                                                    maxWidth: "16px",
                                                    marginRight: "5px",
                                                }}
                                            />
                                        ) : (
                                            <img
                                                src="public/icons/play-button.png"
                                                alt="Resume"
                                                style={{
                                                    maxWidth: "16px",
                                                    marginRight: "5px",
                                                }}
                                            />
                                        )}
                                    </button>
                                    <select
                                        name="schedule"
                                        id="schedule"
                                        onChange={(e) =>
                                            handleAutoRunSettingsChange(
                                                template.id,
                                                { schedule: e.target.value },
                                            )
                                        }
                                        value={
                                            autoRunSettings[template.id]
                                                ?.schedule || "every"
                                        }
                                    >
                                        <option value="every">Every</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>
                                    {autoRunSettings[template.id]?.schedule ===
                                        "every" && (
                                        <>
                                            <input
                                                type="number"
                                                min="1"
                                                defaultValue={
                                                    autoRunSettings[template.id]
                                                        ?.interval || 5
                                                }
                                                onChange={(e) =>
                                                    handleAutoRunSettingsChange(
                                                        template.id,
                                                        {
                                                            interval:
                                                                e.target.value,
                                                        },
                                                    )
                                                }
                                            />
                                            <select
                                                name="unit"
                                                id="unit"
                                                defaultValue={
                                                    autoRunSettings[template.id]
                                                        ?.unit || "minutes"
                                                }
                                                onChange={(e) =>
                                                    handleAutoRunSettingsChange(
                                                        template.id,
                                                        {
                                                            unit: e.target
                                                                .value,
                                                        },
                                                    )
                                                }
                                            >
                                                <option value="minutes">
                                                    Minutes
                                                </option>
                                                <option value="hours">
                                                    Hours
                                                </option>
                                                <option value="days">
                                                    Days
                                                </option>
                                                <option value="weeks">
                                                    Weeks
                                                </option>
                                                <option value="months">
                                                    Months
                                                </option>
                                                <option value="years">
                                                    Years
                                                </option>
                                            </select>
                                        </>
                                    )}
                                    <button
                                        className="save-button"
                                        title="Click to save changes"
                                        onClick={() =>
                                            handleSaveAutoRunSettings(template)
                                        }
                                    >
                                        ✓
                                    </button>
                                </div>
                            </>
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
                        populateFindOptions={qb.populateFindOptions}
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
