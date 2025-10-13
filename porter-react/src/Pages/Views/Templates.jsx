import React from 'react';
import { AppContext } from '../../Context/AppContext';
import { useContext } from 'react';
import { useState , useEffect} from 'react';
import Modal from 'react-modal';
import { useNavigate, useLocation } from 'react-router-dom';


Modal.setAppElement('#root');

export default function Templates() {

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

    // --- Edit modal states ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editTemplateId, setEditTemplateId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editTables, setEditTables] = useState([]);
    const [editSelectedTable, setEditSelectedTable] = useState('');
    const [editTableCols, setEditTableCols] = useState([]);
    const [editForeignKeys, setEditForeignKeys] = useState([]); // same shape as Database.jsx
    const [editRowLimit, setEditRowLimit] = useState(0);
    const [editSelectedCols, setEditSelectedCols] = useState([]);
    const [editSelectedWhere, setEditSelectedWhere] = useState([]);
    const [editFKSelection, setEditFKSelection] = useState([]); // same shape as Database.jsx
    const [editToggles, setEditToggles] = useState({});
    const [editSelectedRFKs, setEditSelectedRFKs] = useState({});

    const WHERE_OPERATORS = [
      '=', '!=', '<', '<=', '>', '>=',
      'LIKE', 'NOT LIKE', 'IN', 'NOT IN',
      'IS NULL', 'IS NOT NULL'
    ];
    const toggleEdit = (id) => setEditToggles(prev => ({...prev, [id]: !prev[id]}));
    const isEditToggled = (id) => !!editToggles[id];

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
                const r = await fetch(`${appAddress}/api/databases/external/tables?name=Gemini`, {
                    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
                });
                const d = await r.json();
                setEditTables(d);
            } catch(e){
                console.error("fetch tables failed", e);
            }
        }
        fetchTables();
    }, [token]);

    useEffect(() => {
            document.title = 'Porter - Templates';
        }, []);

    // open edit modal and prefill all states from template payload
    async function openEditModal(template){
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

        // table and columns: set selected table and fetch its columns
        const t = template.table ?? '';
        setEditSelectedTable(t);
        if (t) {
            try {
                const res = await fetch(`${appAddress}/api/databases/external/tables/${t}`, {
                    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
                });
                const data = await res.json();
                setEditTableCols(data.columns || []);
                setEditForeignKeys(data.foreignKeys || []);
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

        setEditForeignKeys((prev) => {
            const copy = prev.map(p => ({
                parentCol: p.parentCol,
                fkTables: p.fkTables.map(t => ({ tableName: t.tableName, fkColumns: [...t.fkColumns] }))
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
                const r = await fetch(`${appAddress}/api/databases/external/tables/${editSelectedTable}/columns?name=Gemini`, {
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
    }, [editSelectedTable, token]);

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
        const payload = {
            name: editName,
            query: query,
            template: query, // also send 'template' to satisfy update validation mismatch
            database: "Gemini",
            table: editSelectedTable,//#endregion
            user_id: user.id,
            UI: UI
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

    function handleUseTemplate(template) {
        navigate('/export', { state: { template } });
        console.log("Using template:", template);
    }

    return (
        <>
            <h1 className='title'>Query Templates</h1>
            <div className='main-div'>
                {templates.length === 0 ? (
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
                         {templates.map(template => (
                             <li className='template-item' key={template.id}>
                                <span className='template-name'>{template.name}</span>
                                 <span className='template-db'>{template.database}</span>
                                 <span className='template-table'>{template.table}</span>
                                 <span className='template-created-at'>{new Date(template.created_at).toLocaleDateString()}</span>
                                 <span className='template-updated-at'>{new Date(template.updated_at).toLocaleDateString()}</span>
                                 <div className='template-actions'>
                                    <button onClick={() => handleUseTemplate(template)}  title='Click to use template'  className='use-button'>Use</button>
                                     <button onClick={() => handleEdit(template.id)} title='Click to edit template' className='edit-button'>Edit</button>
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
                <div style={{ padding: '1rem', maxWidth: 900 }}>
                    <h2>Edit Template</h2>
                    <div style={{width: "60%", margin: "auto auto 20px auto" }}>
                        <label>Template name</label>
                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>

                    <div style={{width: "60%", margin: "auto auto 20px auto" }}>
                        <label htmlFor="db">Select Database</label>
                        <select name="db" id="db" disabled>
                            <option value="Gemini">Gemini</option>
                        </select>
                        <label htmlFor="table-select">Select a table</label>
                        <select id="table-select" value={editSelectedTable} onChange={(e) => setEditSelectedTable(e.target.value)}>
                            <option value="">Choose a table</option>
                            {editTables.map((t, index) => {
                                // Support both string and object shapes
                                const tableName = typeof t === 'string' ? t : (Object.values(t)[0] ?? JSON.stringify(t));
                                return (
                                    <option key={index} value={tableName}>{tableName}</option>
                                )
                            })}
                        </select>
                    </div>

                    <div className="filterDIV">
                        {editTableCols.length > 0 && (
                            <div className="filterDIVenabled">
                                <button onClick={() => toggleEdit("column-checklist")}> {isEditToggled("column-checklist") ? "▲" : "▼"} Select columns</button> <br />
                                {isEditToggled("column-checklist") && (
                                    <div id="column-checklist" className="column-checklist">
                                        {editTableCols.map((col) => {
                                            const fk = Object.values(editForeignKeys).find(fk => fk.constraint_name === col);
                                            return (
                                                <div key={col} className="column-item">
                                                    <label>
                                                        <input
                                                            type="checkbox"
                                                            checked={editSelectedCols.includes(col)}
                                                            onChange={() => handleEditChange(col)}
                                                        />
                                                        {col}
                                                        {fk && (
                                                            <label
                                                                onClick={() => toggleEdit(fk.constraint_name)}
                                                                style={{ cursor: "pointer", marginLeft: "8px" }}
                                                            >
                                                            {isEditToggled(fk.constraint_name) ? "-" : "+"}
                                                            </label>
                                                        )}
                                                    </label>
                                                    {fk && isEditToggled(fk.constraint_name) && (
                                                        <div className="nested" style={{ marginLeft: "16px" }}>
                                                            <label onClick={() => toggleEdit(`${fk.constraint_name}-table`)}>
                                                                <strong>{fk.referenced_table}</strong> {isEditToggled(`${fk.constraint_name}-table`) ? "-" : "+"}
                                                            </label>
                                                            {isEditToggled(`${fk.constraint_name}-table`) && (
                                                                <div style={{ marginLeft: "16px" }}>
                                                                    {fk.referenced_table_columns.map((fkcol, i) =>
                                                                        fkcol === fk.referenced_column ? null : (
                                                                            <div key={i} className="fk-details">
                                                                                <label>
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={Array.isArray(editSelectedRFKs[fk.constraint_name]) && editSelectedRFKs[fk.constraint_name].includes(fkcol)}
                                                                                        onChange={() => handleEditFKSelection(fk.constraint_name, fk.referenced_table, fkcol)}
                                                                                    />
                                                                                    {fkcol}
                                                                                </label>
                                                                            </div>
                                                                        )) }
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="whereSection" id="whereSection">
                                    <h3>WHERE conditions</h3>
                                    {(() => {
                                        const fkList = Array.isArray(editForeignKeys) ? editForeignKeys : Object.values(editForeignKeys || {});
                                        const fkOptions = fkList.flatMap(fk =>
                                            Array.isArray(fk.referenced_table_columns)
                                                ? fk.referenced_table_columns
                                                    .filter(c => c !== fk.referenced_column)
                                                    .map(c => `${fk.referenced_table}.${c}`)
                                                : []
                                        );
                                        const combinedOptions = Array.from(new Set([...(Array.isArray(editTableCols) ? editTableCols : Object.keys(editTableCols || {})), ...fkOptions]));
                                        const optionsList = combinedOptions;
                                        const selected = Array.isArray(editSelectedWhere) ? editSelectedWhere : [];

                                        return (
                                            <>
                                                {selected.map((row, idx) => {
                                                    const currentCol = row?.column ?? '';
                                                    const opts = optionsList.filter(o => o === currentCol || !selected.some(s => s.column === o));
                                                    return (
                                                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                                            <select value={currentCol} onChange={(e) => handleEditSelectedWhere(e, idx)} >
                                                                <option value="">-- Choose Column --</option>
                                                                {opts.map((col) => <option key={col} value={col}>{col}</option>)}
                                                            </select>
                                                            {currentCol && (
                                                                <select value={row.operator ?? '='} onChange={(e) => handleEditWhereOperatorChange(idx, e.target.value)}>
                                                                    {WHERE_OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                                                                </select>
                                                            )}
                                                            {currentCol && !(row.operator === 'IS NULL' || row.operator === 'IS NOT NULL') && (
                                                                <input type="text" placeholder="value" value={row.value ?? ''} onChange={(e) => handleEditWhereValueChange(idx, e.target.value)} />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                <select key="extra" value="" className="blankSelect" onChange={(e) => handleEditSelectedWhere(e, selected.length)}>
                                                    <option value="" >-- Choose Column --</option>
                                                    {optionsList.filter(o => !selected.some(s => s.column === o)).map((col) => (
                                                        <option key={col} value={col}>{col}</option>
                                                    ))}
                                                </select>
                                            </>
                                        );
                                    })()}
                                </div>
                                <br /><br />
                                <label>Row limit</label>
                                <input type="number" value={editRowLimit} onChange={(e) => setEditRowLimit(e.target.value)} style={{fontSize:"20px"}}/> <br />
                                <br />
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={handleSaveEditedTemplate} className="edit-button">Save changes</button>
                                    <button onClick={closeEditModal} className="delete-button">Cancel</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
            {/* end edit modal */}
        </>
    );
}