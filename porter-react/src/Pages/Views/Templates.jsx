import React from 'react';
import { AppContext } from '../../Context/AppContext';
import { useContext } from 'react';
import { useState , useEffect} from 'react';
import Modal from 'react-modal';
import { useNavigate, useLocation } from 'react-router-dom';
import Select from 'react-select';
import Tippy from '@tippyjs/react';
import Switch from 'react-switch';

import FRRuleField from '../../Components/FRRuleField';
import LimitOffsetRuleField from '../../Components/LimitOffsetRuleField';
import ColumnNameChange from '../../Components/ColumnNameChange';

Modal.setAppElement('#root');

export default function Templates() {

    const [loading, toggleLoading] = useState(false);

    const { appAddress } = useContext(AppContext);

    const location = useLocation(); 
    const navigate = useNavigate();

    // show message if navigated from another page with state
    useEffect(() => {
        if (location.state && location.state.message) {
            openMessageModal(location.state.message);
            setMessageSuccess(true);
            // Clear the state to prevent showing the message again on future navigations
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate]);

    const [templates, setTemplates] = useState([]);
    const { user, token } = useContext(AppContext);

    // new state for modal
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState(null);

    // --- Message modal states ---
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [messageSuccess, setMessageSuccess] = useState(true); // true for success, false for error
    const [loadingMessage, setLoadingMessage] = useState('');

    // --- Edit modal states ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editTemplateId, setEditTemplateId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editTables, setEditTables] = useState([]);
    const [editSelectedTable, setEditSelectedTable] = useState('');
    const [editSelectedDatabase, setEditSelectedDatabase] = useState('');
    const [editTableCols, setEditTableCols] = useState([]);
    const [editForeignKeys, setEditForeignKeys] = useState([]); // same shape as TQB.jsx
    const [editTableData, setEditTableData] = useState([]);
    const [editShowSuccessGlow, setEditShowSuccessGlow] = useState(false);
    const [editRowLimit, setEditRowLimit] = useState(0);
    const [editSelectedCols, setEditSelectedCols] = useState([]);
    const [editSelectedWhere, setEditSelectedWhere] = useState([]);
    const [editFKSelection, setEditFKSelection] = useState([]); // same shape as TQB.jsx
    const [editToggles, setEditToggles] = useState({});
    const [editSelectedRFKs, setEditSelectedRFKs] = useState({});

    const WHERE_OPERATORS = [
      '=', '!=', '<', '<=', '>', '>=',
      'LIKE', 'NOT LIKE', 'IN', 'NOT IN',
      'IS NULL', 'IS NOT NULL'
    ];
    // Export-related state (match TQB features so edit modal can edit export rules)
    const [findOptions, setFindOptions] = useState({});
    const [FRRules, setFRRules] = useState([]); // find/replace rules
    const [limitOffsetRules, setLimitOffsetRules] = useState([]);
    const [columnNameChanges, setColumnNameChanges] = useState([]);
    const [showColumnWindow, setShowColumnWindow] = useState(false);
    const [exportType, setExportType] = useState(false); // false = CSV, true = DB
    const [targetDatabase, setTargetDatabase] = useState("");
    const [targetTable, setTargetTable] = useState("");
    const [dbTables, setDbTables] = useState([]);
    const [showWarning, setShowWarning] = useState(false);
    const toggleEdit = (id) => setEditToggles(prev => ({...prev, [id]: !prev[id]}));
    const isEditToggled = (id) => !!editToggles[id];

    // helper functions for export rules
    const addFRRule = () => setFRRules(prev => [...prev, { find: "", replace: "" }]);
    const removeFRRule = (idx) => setFRRules(prev => prev.filter((_, i) => i !== idx));
    const handleFRRuleChange = (index, field, value) => {
        setFRRules(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
    };

    const addLimitOffset = () => setLimitOffsetRules(prev => [...prev, { limit: 1000, offset: 0 }]);
    const removeLimitOffsetRule = (idx) => setLimitOffsetRules(prev => prev.filter((_, i) => i !== idx));
    const handleLimitOffsetChange = (index, field, value) => {
        setLimitOffsetRules(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
    };

    const handleColumnNameChange = (index, field, value) => {
        setColumnNameChanges(prev => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    };

    // fetch tables for a selected target database
    useEffect(() => {
        if (!targetDatabase || !token) { setDbTables([]); return; }
        let cancelled = false;
        async function fetchDbTables(){
            try {
                const r = await fetch(`${appAddress}/api/databases/external/tables?name=${encodeURIComponent(targetDatabase)}`, {
                    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
                });
                const d = await r.json();
                if (cancelled) return;
                setDbTables(d.tables || []);
            } catch(e) {
                console.error('fetch target db tables failed', e);
                setDbTables([]);
            }
        }
        fetchDbTables();
        return () => { cancelled = true; }
    }, [targetDatabase, token, appAddress]);

    useEffect(() => {
        fetchTemplates();
    }, []);

    function openMessageModal(msg) {
        setMessage(msg);
        setIsMessageModalOpen(true);
        setTimeout(() => {
            setIsMessageModalOpen(false);
        }, 3000); // auto-close after 3 seconds 
    }

    
    async function fetchTemplates(){
        const response = await fetch(`${appAddress}/api/query-templates`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            }
        });
        const data = await response.json();
        setTemplates(data);
        console.log(data);
    }

    // fetch tables for edit modal & general usage
    useEffect(() => {
        if (!token) return;
        async function fetchTables(){
            try {
                const r = await fetch(`${appAddress}/api/databases/external/tables?name=${editSelectedDatabase}`, {
                    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
                });
                const d = await r.json();
                setEditTables(d.tables || []);
                console.log("Fetched tables for edit modal", d.tables || []);

            } catch(e){
                console.error("fetch tables failed", e);
            }
        }
        fetchTables();
    }, [ editSelectedDatabase]);

    useEffect(() => {
            document.title = 'Porter - Templates';
        }, []);

    // open edit modal and prefill all states from template payload
    async function openEditModal(template){

        // set loading state while fetching data
        setLoadingMessage("Loading template data... ")
        // base fields
        setEditTemplateId(template.id);
        setEditName(template.name ?? '');
        const q = template.query ?? {};
        setEditRowLimit(q.limit ?? 0);
        setEditSelectedCols(Array.isArray(q.columns) ? q.columns : (q.columns ? [q.columns] : []));
        setEditSelectedWhere(Array.isArray(q.where) ? q.where : []);
        setEditFKSelection(Array.isArray(q.selection) ? q.selection : []);
        setEditToggles((template.UI && template.UI.toggles) ? template.UI.toggles : {});
        setEditSelectedRFKs((template.UI && template.UI.selectedRFKs) ? template.UI.selectedRFKs : {});

        // populate export-related fields if present on the template
        const ex = template.export ?? {};
        setExportType(Boolean(ex.exportType));
        setTargetDatabase(ex.targetDatabase ?? "");
        setTargetTable(ex.targetTable ?? "");
        setFRRules(Array.isArray(ex.findReplaceRules) ? ex.findReplaceRules : []);
        setLimitOffsetRules(Array.isArray(ex.limitOffsetRules) ? ex.limitOffsetRules : []);
        setColumnNameChanges(Array.isArray(ex.columnNameChanges) ? ex.columnNameChanges : []);

        // table and columns: set selected table and fetch its columns
        const t = template.table ?? '';
        setEditSelectedTable(t);
        setEditSelectedDatabase(template.database ?? '');
            if (t) {
                try {
                    // include database name so the external DB controller can scope the table columns
                    const dbName = encodeURIComponent(template.database ?? editSelectedDatabase);
                    const res = await fetch(`${appAddress}/api/databases/external/tables/${encodeURIComponent(t)}/columns?name=${dbName}`, {
                        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, method: 'GET'
                    });
                    if (!res.ok) {
                        console.error('Failed to fetch table columns for edit, status', res.status);
                        setEditTableCols([]);
                        setEditForeignKeys([]);
                    } else {
                        const data = await res.json();
                        setEditTableCols(data.columns || []);
                        setEditForeignKeys(data.foreignKeys || []);
                    }
                    // Fetch preview data for this template's table
                    await handleFetchEditTableData(t, template.database ?? editSelectedDatabase);
                } catch (err) {
                    console.error("failed to load columns for edit", err);
                }
            } else {
                setEditTableCols([]);
                setEditForeignKeys([]);
            }
        setIsEditModalOpen(true);
    }

    function closeEditModal(){
        setIsEditModalOpen(false);
        setEditTemplateId(null);
    }

    // toggle column selection in edit modal
    function handleEditChange(col){
        setEditSelectedCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
    }

    // handle FK selections for edit modal (same shape as Database.jsx handler)
    function handleEditFKSelection(parentCol, tableName, fkColumn){
        setEditSelectedRFKs((prev) => {
            const copy = { ...prev };
            const list = Array.isArray(copy[parentCol]) ? [...copy[parentCol]] : [];
            const idx = list.indexOf(fkColumn);
            if (idx === -1) list.push(fkColumn); else list.splice(idx, 1);
            if (list.length) copy[parentCol] = list; else delete copy[parentCol];
            return copy;
        });

        // Maintain a separate selection structure (editFKSelection) and do not overwrite
        // the backend-provided editForeignKeys metadata used for rendering.
        setEditFKSelection((prev) => {
            const prevArr = Array.isArray(prev) ? prev : [];
            const copy = prevArr.map(p => ({
                parentCol: p.parentCol,
                fkTables: (p.fkTables || []).map(t => ({ tableName: t.tableName, fkColumns: [...(t.fkColumns || [])] }))
            }));
            const parentIdx = copy.findIndex(p => p.parentCol === parentCol);
            if (parentIdx === -1) {
                return [...copy, { parentCol, fkTables: [{ tableName, fkColumns: [fkColumn] }] }];
            }
            const parent = copy[parentIdx];
            const tableIdx = parent.fkTables.findIndex(t => t.tableName === tableName);
            if (tableIdx === -1) {
                parent.fkTables.push({ tableName, fkColumns: [fkColumn] });
            } else {
                const table = parent.fkTables[tableIdx];
                const colIdx = table.fkColumns.indexOf(fkColumn);
                if (colIdx === -1) table.fkColumns.push(fkColumn);
                else {
                    table.fkColumns.splice(colIdx, 1);
                    if (table.fkColumns.length === 0) parent.fkTables.splice(tableIdx, 1);
                }
            }
            if (parent.fkTables.length === 0) copy.splice(parentIdx, 1);
            return copy;
        });
    }

    // where handlers in edit modal
    const handleEditSelectedWhere = (e, idx) => {
        const val = e.target.value;
        setEditSelectedWhere((prev = []) => {
            const copy = [...prev];
            if (idx === copy.length) {
                if (!val) return copy;
                return [...copy, { column: val, operator: '=', value: '' }];
            }
            if (!val) {
                if (copy.length > 1) { copy.splice(idx, 1); return copy; }
                return [];
            }
            copy[idx] = { ...(copy[idx] || {}), column: val, operator: copy[idx]?.operator ?? '=', value: copy[idx]?.value ?? '' };
            return copy;
        });
    };
    const handleEditWhereOperatorChange = (idx, operator) => {
        setEditSelectedWhere((prev = []) => {
            const copy = [...prev];
            if (!copy[idx]) return copy;
            copy[idx] = { ...copy[idx], operator };
            if (operator === 'IS NULL' || operator === 'IS NOT NULL') copy[idx].value = '';
            return copy;
        });
    };
    const handleEditWhereValueChange = (idx, value) => {
        setEditSelectedWhere((prev = []) => {
            const copy = [...prev];
            if (!copy[idx]) return copy;
            copy[idx] = { ...copy[idx], value };
            return copy;
        });
    };

    // when user picks a different table in edit modal, fetch its columns
    useEffect(() => {
        if (!editSelectedTable || !token) return;
        let cancelled = false;
        async function fetchCols(){
            try {
                const dbName = encodeURIComponent(editSelectedDatabase);
                const r = await fetch(`${appAddress}/api/databases/external/tables/${encodeURIComponent(editSelectedTable)}/columns?name=${dbName}`, {
                    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
                });
                const d = await r.json();
                if (cancelled) return;
                setEditTableCols(d.columns || []);
                setEditForeignKeys(d.foreignKeys || []);
            } catch (e) {
                console.error("fetch edit table cols failed", e);
            }
        }
        fetchCols();
        return () => { cancelled = true; }
    }, [editSelectedTable, token, editSelectedDatabase, appAddress]);

    // Fetch preview data for the edit modal (modeled on TQB.jsx)
    async function handleFetchEditTableData(tableName = editSelectedTable, dbName = editSelectedDatabase) {
        if (!tableName) return;
        try {
            toggleLoading(true);
            const payload = {};
            if (dbName) payload.name = dbName;
            if (editRowLimit && Number(editRowLimit) > 0) payload.limit = Number(editRowLimit);
            if (Array.isArray(editSelectedCols) && editSelectedCols.length > 0) payload.columns = editSelectedCols;
            if (Array.isArray(editFKSelection) && editFKSelection.length > 0) payload.foreign_keys = editFKSelection;
            if (Array.isArray(editSelectedWhere) && editSelectedWhere.length > 0) payload.where = editSelectedWhere;

            const resource = await fetch(`${appAddress}/api/databases/external/tables/${encodeURIComponent(tableName)}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!resource.ok) throw new Error(`Error ${resource.status}`);
            const data = await resource.json();

            setEditShowSuccessGlow(true);
            setTimeout(() => setEditShowSuccessGlow(false), 2000);

            const rows = Array.isArray(data) ? data : (data.rows ?? data.data ?? []);
            setEditTableData(rows);
        } catch (err) {
            console.error('Failed to fetch edit preview data:', err);
        } finally {
            toggleLoading(false);
        }
    }

    // save edited template
    async function handleSaveEditedTemplate(){
        if (!editTemplateId) return;

        const query = {};
        
        if (editRowLimit && Number(editRowLimit) > 0) query.limit = Number(editRowLimit);
        if (Array.isArray(editSelectedCols) && editSelectedCols.length > 0) query.columns = editSelectedCols;
        if (Array.isArray(editForeignKeys) && editForeignKeys.length > 0) query.foreign_keys = editForeignKeys;
        if (Array.isArray(editSelectedWhere) && editSelectedWhere.length > 0) query.where = editSelectedWhere;
        if (Object.keys(query).length === 0) query.columns = ["*"];

        const UI = { toggles: editToggles, selectedRFKs: editSelectedRFKs };
        const eggsport = {
            exportType: exportType,
            targetDatabase: targetDatabase,
            targetTable: targetTable,
            findReplaceRules: FRRules,
            limitOffsetRules: limitOffsetRules,
            columnNameChanges: columnNameChanges
        };

        const payload = {
            name: editName,
            query: query,
            template: query, // also send 'template' to satisfy update validation mismatch
            database: editSelectedDatabase,
            table: editSelectedTable,//#endregion
            user_id: user.id,
            UI: UI,
            export: eggsport
        };
        try {
            const res = await fetch(`${appAddress}/api/query-templates/${editTemplateId}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) {
                setMessageSuccess(false);
                openMessageModal("Failed to update template");
                throw new Error(data?.message || 'Update failed');
            }
            // update local templates list
            setTemplates(prev => prev.map(t => t.id === editTemplateId ? data : t));
            closeEditModal();
            setMessageSuccess(true);
            openMessageModal("Template updated successfully");
        } catch (err) {
            console.error("Failed to save edited template", err);
            // optionally show error to user
        }
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

    // perform the actual delete when user confirms in modal
    async function confirmDelete() {
        if (!templateToDelete) return;

        const id = templateToDelete.id;
        const response = await fetch(`${appAddress}/api/query-templates/${id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            }
        });

        if (response.ok) {
            setTemplates(templates.filter(template => template.id !== id));
            
        } else {
            console.error("Failed to delete template");
        }
        setMessageSuccess(true);
        openMessageModal("Template deleted successfully");
        
        closeDeleteModal();
    }

    // placeholder edit handler (keep or implement)
    function handleEdit(id) {
        const t = templates.find(x => x.id === id);
        if (!t) return;
        openEditModal(t);
    }


    

    

    async function handleUseTemplate(template) {
        // navigate('/export', { state: { template } });
        console.log("Using template:", template);
        try {
            toggleLoading(true);
            
            console.log('payload for export', template);
            setTimeout(() => {
                    if (loading) {
                        setLoadingMessage("That's a lot of data! This may take a while...")
                    }
                }, 3000);
            const response = await fetch(`${appAddress}/api/export`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(template)
            });

            if (!response.ok) {
                console.error('Export failed with status:', response.status);
                throw new Error('Failed to export data');
            }
            if (!template.export.exportType) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${template.name}_export.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                navigate('/templates', { state: { message: `Export successful! Exported to ${template.name + '_export.csv'}` } });
                
            } else {
                const blob = await response.json();
                navigate('/templates', { state: { message: `Export successful! Exported to  ${template.export.targetDatabase}, table ${template.export.targetTable}. ${blob.total_inserted} rows inserted, ${blob.total_skipped} rows skipped.` } });
            }
        } catch (error) {
            console.error('Error exporting data:', error);
            alert('Error exporting data. Please try again later.');
        } finally {
            toggleLoading(false);
            

        }

    }

    // Templates visible to current user (admins see all)
    const visibleTemplates = templates.filter(t => (user?.admin === 1) || (t.user_id === user?.id));

    return (
        <>
            <h1 className='title'>Query Templates</h1>
            <div className='main-div'>
                {visibleTemplates.length === 0 ? (
                    <p>No templates found.</p>
                ) : (
                    <ul className='template-list'>
                        {/* header row for columns */}
                        <li className='template-item template-header' key="header" style={{fontWeight: 700, background: 'transparent', border: 'none', cursor: 'default', maxHeight: 'none'}}>
                            <span className='template-name'>Name</span>
                            <span className='template-db'>Database</span>
                            <span className='template-table'>Table</span>
                            <span className='template-created-at' style={{minWidth: '120px'}}>Created at</span>
                            <span className='template-updated-at' style={{minWidth: '140px'}}>Last Updated</span>
                            <span className='template-actions'>Actions</span>
                        </li>
                        {visibleTemplates.map(template => (
                            <li className='template-item' key={template.id}>
                                <span className='template-name'>{template.name}</span>
                                <span className='template-db'>{template.database}</span>
                                <span className='template-table'>{template.table}</span>
                                <span className='template-created-at'>{new Date(template.created_at).toLocaleDateString()}</span>
                                <span className='template-updated-at'>{new Date(template.updated_at).toLocaleDateString()}</span>
                                <div className='template-actions'>
                                    <button onClick={() => handleUseTemplate(template)}  title='Click to use template'  className='use-button'>Use</button>
                                    <button onClick={() => handleEdit(template.id)} title='Click to edit template' className='edit-button'>Edit [wip]</button>
                                    <button onClick={() => openDeleteModal(template)} title='Click to delete template' className='delete-button'>X</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Message modal */}
            <Modal isOpen={isMessageModalOpen} onRequestClose={isMessageModalOpen} contentLabel="Message" className={`message-modal ${messageSuccess ? 'success' : 'error'}`} overlayClassName="none">
                <div style={{ padding: '1rem' }}>
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
                <div style={{ padding: '1rem' }}>
                    <h2>Confirm Delete</h2>
                    <p>Are you sure you want to delete the template "{templateToDelete?.name}"?</p>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button onClick={confirmDelete} className="delete-button">Delete</button>
                        <button onClick={closeDeleteModal} className="edit-button">Cancel</button>
                    </div>
                </div>
            </Modal>

            {/* Edit template modal */}
            <Modal 
                isOpen={isEditModalOpen}
                onRequestClose={closeEditModal}
                contentLabel="Edit Template"
                className="edit-modal" 
                overlayClassName="modal-overlay">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>Edit Template{editName ? ` - ${editName}` : ''}</h2>
                    <img src="/icons/refresh-page-option.png" alt="Refresh Preview" className="refresh-button" onClick={() => handleFetchEditTableData()} style={{ cursor: 'pointer' }} />
                </div>
                <div style={{ marginTop: '0.75rem' }}>
                    {editSelectedTable && editTableData.length > 0 ? (
                        <div className={`tableContainer ${editShowSuccessGlow ? 'successGlow' : ''}`}>
                            <table border="1" cellPadding="5">
                                <thead>
                                    <tr>
                                        {Object.keys(editTableData[0]).map((col, idx) => (
                                            <th key={idx}>{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {editTableData.map((row, i) => (
                                        <tr key={i}>
                                            {Object.values(row).map((val, j) => (
                                                <td key={j}>{String(val)}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p style={{ color: '#999' }}>{editSelectedTable ? 'No preview rows returned.' : 'No table selected for preview.'}</p>
                    )}
                </div>
            </Modal>
            {/* end edit modal */}

            {/* Loading modal */}
            <Modal 
                isOpen={loading} 
                onRequestClose={() => toggleLoading(false)}
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