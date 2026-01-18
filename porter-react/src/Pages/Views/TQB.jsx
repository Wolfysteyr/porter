import { useContext, useState, useEffect, useCallback } from "react"
import Select from 'react-select';
import { AppContext } from "../../Context/AppContext"
import { useNavigate } from "react-router-dom";
import Modal from 'react-modal';
import Tippy from '@tippyjs/react';
import Switch from 'react-switch';
import TemplateSideMenu from "../../Components/TemplateSideMenu";



export default function TQB(){

    const { appAddress } = useContext(AppContext);

    const navigate = useNavigate();


    const [loading, toggleLoading] = useState(false);

    //errors, wip
    const [templateNameErr, setTemplateNameErr] = useState(false);
    const [templateNameErrMsg, setTemplateNameErrMsg] = useState("");
    const [message, setMessage] = useState("");
    const [messageSuccess, setMessageSuccess] = useState(false);
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [showWarning, setShowWarning] = useState(false);

    const {token, user} = useContext(AppContext);

    // success glow animation trigger, wish it wasnt necessary
    const [showSuccessGlow, setShowSuccessGlow] = useState(false);

    // list of available tables in db
    const [tables, setTables] = useState([]); 
    const [databases, setDatabases] = useState([]); // for future use if internal dbs are added
    
    async function getDatabases() {
        try {
            const response = await fetch(`${appAddress}/api/databases/external`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error(`Status ${response.status}`);
            const data = await response.json();
            setDatabases(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch databases:", err);
            setDatabases([]);
        }
    }

    // new database modal vars
    const [newDBName, setNewDBName] = useState("");
    const [newDBdescription, setNewDBdescription] = useState("");
    const [newDBDriver, setNewDBDriver] = useState("mysql");
    const [newDBHost, setNewDBHost] = useState("127.0.0.1");
    const [newDBPort, setNewDBPort] = useState("3306");
    const [newDBUsername, setNewDBUsername] = useState("root");
    const [newDBPassword, setNewDBPassword] = useState("");

    async function handleCreateNewDatabase() {
        toggleLoading(true);
        const payload = {
            name: newDBName,
            description: newDBdescription,
            driver: newDBDriver,
            host: newDBHost,
            port: newDBPort,
            username: newDBUsername,
            password: newDBPassword
        };
        // create new external database record
         try {
            console.log("Creating new database:", payload);
             const response = await fetch(`${appAddress}/api/databases/external`, {
                 method: "POST",
                 headers: {
                     "Content-Type": "application/json",
                     Authorization: `Bearer ${token}`,
                 },
                 body: JSON.stringify(payload),
             });
             
             if (!response.ok) {
                 const errorData = await response.json();
                 const errorMsg = errorData?.message || "An error occurred";
                 throw new Error(errorMsg);
             } 
             const data = await response.json();
             await getDatabases(); // refresh database list
            // prefer selecting by description (backend lookups use description)
            setSelectedDatabase(data.name);
            setToggleNewDBModal(false);
            showMessage("Database created successfully!", true);
         } catch (error) {
             console.error("Error creating new database:", error);
             showMessage(`Error creating new database: ${error.message}`, false);
         } finally {
             toggleLoading(false);
         }
    }
    
    function showMessage(msg, success) {
        setMessage(msg);
        setMessageSuccess(success);
        setIsMessageModalOpen(true);
        setTimeout(() => {
            setIsMessageModalOpen(false);
        }, 3000); // auto-close after 3 seconds
    }

    // payload vars, sent to backend to generate query template and show it
    // also used for template saving
    const [selectedDatabase, setSelectedDatabase] = useState(""); // hardcoded for now, later can add internal db support
    const [selectedTable, setSelectedTable] = useState("");
    const [rowLimit, setRowLimit] = useState("");
    const [selectedCols, setSelectedCols] = useState([]);
    const [selectedWhere, setSelectedWhere] = useState([]);
    const [foreignKeysSelection, setForeignKeysSelection] = useState([]); // { parentCol: string, fkTables: { tableName: string, fkColumns: [string] }[] }
    const [templateName, setTemplateName] = useState("");
    const [exportType, setExportType] = useState(false); // false = CSV, true = SQL

    const toggleExportType = () => {
        setExportType(prev => !prev);
        setColumnNameChanges([]);
        if (exportType) {
            setColumnNameChanges(prev => [...prev, { original: '', new: '' }]);
        }

    };

    // used for toggling visibility of various sections, also part of template
    const [toggles, setToggles] = useState({}); // { id: bool }
    // selected referenced foreign keys stored per parent FK constraint: { [parentCol]: [fkColumnName] }
    const [selectedRFKs, setSelectedRFKs] = useState({}); // { parentCol: [fkcol, ...] }
    const [toggleNewDBModal, setToggleNewDBModal] = useState(false);
    
    // side menu UI state (moved from TemplateSideMenu)
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menus, setMenus] = useState({});

    // computed counts for columns and selected referenced FKs
    const selectedColsCount = Array.isArray(selectedCols) ? selectedCols.length : 0;
    const selectedRFKsCount = selectedRFKs && typeof selectedRFKs === 'object'
        ? Object.values(selectedRFKs).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
        : 0;

    // Automation state and logic
    const [isAutomated, setIsAutomated] = useState(false);
    const [automationSchedule, setAutomationSchedule] = useState('every');
    const [automationPeriod, setAutomationPeriod] = useState('5');
    const [automationUnit, setAutomationUnit] = useState('minutes');

    const handleAutomationToggle = (checked) => {
        const next = typeof checked === 'boolean' ? checked : !isAutomated;
        setIsAutomated(next);
        if (!next) {
            setAutomationSchedule('every');
            setAutomationPeriod('5');
            setAutomationUnit('minutes');
        } else {
            setAutomationSchedule(prev => prev || 'Daily');
        }
    };

    // helper toggles for FK expansion etc.
    const toggle = (id) => {
        setToggles((prev) => ({ ...prev, [id]: !prev[id] }));
    };
    const isToggled = (id) => !!toggles[id];

    // FR/Limit/Column name helpers
    const addFRRule = () => setFRRules((prev) => [...prev, { find: "", replace: "" }]);
    const addLimitOffset = () => setLimitOffsetRules((prev) => [...prev, { limit: 1000, offset: 0 }]);
    const handleFRRuleChange = (index, field, value) => setFRRules((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    const handleLimitOffsetChange = (index, field, value) => setLimitOffsetRules((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    const handleColumnNameChange = useCallback((index, field, value) => {
        setColumnNameChanges((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    }, []);
    const removeFRRule = (index) => setFRRules((prev) => prev.filter((_, i) => i !== index));
    const removeLimitOffsetRule = (index) => setLimitOffsetRules((prev) => prev.filter((_, i) => i !== index));
    const removeColumnChange = (index) => setColumnNameChanges((prev) => prev.filter((_, i) => i !== index));

    // change selected columns
    const handleChange = (col) => {
        setSelectedCols((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]);
    };

    // where clause helpers
    const WHERE_OPERATORS = [
        '=', '!=', '<', '<=', '>', '>=',
        'LIKE', 'NOT LIKE', 'IN', 'NOT IN',
        'IS NULL', 'IS NOT NULL'
    ];

    const handleSelectedWhere = (e, idx) => {
        const val = e.target.value;
        setSelectedWhere((prev = []) => {
            const copy = [...prev];
            if (idx === copy.length) {
                if (!val) return copy;
                return [...copy, { column: val, operator: '=', value: '' }];
            }
            if (!val) {
                if (copy.length > 1) {
                    copy.splice(idx, 1);
                    return copy;
                }
                return [];
            }
            copy[idx] = { ...(copy[idx] || {}), column: val, operator: copy[idx]?.operator ?? '=', value: copy[idx]?.value ?? '' };
            return copy;
        });
    };

    const handleWhereOperatorChange = (idx, operator) => {
        setSelectedWhere((prev = []) => {
            const copy = [...prev];
            if (!copy[idx]) return copy;
            copy[idx] = { ...copy[idx], operator };
            if (operator === 'IS NULL' || operator === 'IS NOT NULL') copy[idx].value = '';
            return copy;
        });
    };

    const handleWhereValueChange = (idx, value) => {
        setSelectedWhere((prev = []) => {
            const copy = [...prev];
            if (!copy[idx]) return copy;
            copy[idx] = { ...copy[idx], value };
            return copy;
        });
    };

    // manage selected referenced foreign keys and structured foreignKeysSelection
    function handleFKSelection(parentCol, tableName, fkColumn) {
        setSelectedRFKs((prev) => {
            const copy = { ...prev };
            const list = Array.isArray(copy[parentCol]) ? [...copy[parentCol]] : [];
            const idx = list.indexOf(fkColumn);
            if (idx === -1) list.push(fkColumn); else list.splice(idx, 1);
            if (list.length) copy[parentCol] = list; else delete copy[parentCol];
            return copy;
        });

        setForeignKeysSelection((prev) => {
            const copy = prev.map(p => ({ parentCol: p.parentCol, fkTables: p.fkTables.map(t => ({ tableName: t.tableName, fkColumns: [...t.fkColumns] })) }));
            const parentIdx = copy.findIndex(p => p.parentCol === parentCol);
            if (parentIdx === -1) {
                return [...copy, { parentCol, fkTables: [{ tableName, fkColumns: [fkColumn] }] }];
            }
            const parent = copy[parentIdx];
            const tableIdx = parent.fkTables.findIndex(t => t.tableName === tableName);
            if (tableIdx === -1) parent.fkTables.push({ tableName, fkColumns: [fkColumn] });
            else {
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

    function resetRules() {
        setSelectedCols([]);
        setSelectedWhere([]);
        setForeignKeysSelection([]);
        setSelectedRFKs([]);
        setRowLimit("");
        setUpdatedData(false);
    }

    function handleMenuToggle() {
        setIsMenuOpen(!isMenuOpen);
    }

    function toggleMenus(menuName) {
        setMenus(prevState => {
            const newState = {};
            Object.keys(prevState).forEach(key => { newState[key] = false; });
            newState[menuName] = !prevState[menuName];
            return newState;
        });
    }

    function handleNewDatabase($database) {
        if ($database !== "New Database") {
            setSelectedDatabase($database);
            setTableCols([]);
            setTableData([]);
            setSelectedCols([]);
            setSelectedWhere([]);
            setForeignKeysSelection([]);
            setUpdatedData(false);
            return;
        }
        setToggleNewDBModal(true);
    }

    // populate find options (API) — kept in view
    async function populateFindOptions() {
        try {
            if (Object.keys(findOptions).length > 0) return findOptions;
            toggleLoading(true);
            const payload = {
                name: selectedDatabase,
                columns: selectedCols.length > 0 ? selectedCols : ['*'],
                where: selectedWhere.length > 0 ? selectedWhere : [],
                foreign_keys: foreignKeysSelection.length > 0 ? foreignKeysSelection : [],
                limit: 10000,
            };

            const response = await fetch(`${appAddress}/api/databases/external/tables/${encodeURIComponent(selectedTable)}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, Accept: "application/json", 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) return {};
            const data = await response.json();
            const grouped = {};
            (data.rows || []).forEach(row => {
                Object.entries(row).forEach(([key, val]) => {
                    if (!grouped[key]) grouped[key] = new Set();
                    grouped[key].add(val);
                });
            });
            Object.keys(grouped).forEach(key => { grouped[key] = Array.from(grouped[key]); });
            setFindOptions(grouped);
            return grouped;
        } catch (err) {
            console.error('populateFindOptions error', err);
            return {};
        } finally {
            toggleLoading(false);
        }
    }

    const handleSaveTemplate = () => {
        setTemplateNameErr(false);

        let query = {};
        if (Array.isArray(selectedCols) && selectedCols.length > 0) query.columns = selectedCols;

        if (Array.isArray(foreignKeysSelection) && foreignKeysSelection.length > 0) {
            query.foreign_keys = foreignKeysSelection;
        } else if (selectedRFKs && Object.keys(selectedRFKs).length > 0) {
            const derived = Object.keys(selectedRFKs).map((parentCol) => {
                const fkMeta = Array.isArray(foreignKeys)
                    ? foreignKeys.find(f => f.column_name === parentCol)
                    : Object.values(foreignKeys || {}).find(f => f.column_name === parentCol);
                const tableName = fkMeta?.referenced_table || null;
                const fkCols = Array.isArray(selectedRFKs[parentCol]) ? selectedRFKs[parentCol] : [];
                return { parentCol, fkTables: tableName ? [{ tableName, fkColumns: fkCols }] : [] };
            }).filter(item => item.fkTables && item.fkTables.length > 0);
            if (derived.length > 0) query.foreign_keys = derived;
        }

        if (Array.isArray(selectedWhere) && selectedWhere.length > 0) query.where = selectedWhere;
        if (Object.keys(query).length === 0) query.columns = ["*"];

        let auto = {};
        if (isAutomated) {
            if (automationSchedule !== 'every') auto = { schedule: automationSchedule, interval: null, unit: null };
            else auto = { schedule: automationSchedule, interval: automationPeriod, unit: automationUnit };
        } else auto = { schedule: null, interval: null, unit: null };

        let UI = { toggles, selectedRFKs };
        let eggsport = { exportType, targetDatabase, targetTable, findReplaceRules: FRRules, limitOffsetRules, columnNameChanges };

        let automation = { enabled: false };
        if (isAutomated) {
            if (automationSchedule === 'Every ...') {
                const n = Number(automationPeriod);
                if (!n || n <= 0) {
                    showMessage('Please provide a positive number for automation interval.', false);
                    return;
                }
                automation = { enabled: true, schedule: automationSchedule, interval: n, unit: automationUnit };
            } else if (automationSchedule) automation = { enabled: true, schedule: automationSchedule };
            else { showMessage('Please choose an automation schedule or disable automation.', false); return; }
        }

        const payload = { name: templateName, database: selectedDatabase, table: selectedTable, query, export: eggsport, automation, user_id: user.id, auto, UI };

        fetch(`${appAddress}/api/query-templates`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
            .then(async response => {
                const data = await response.json();
                if (!response.ok) {
                    const errorMsg = data?.message || "An error occurred";
                    setTemplateNameErr(true);
                    setTemplateNameErrMsg(errorMsg);
                    throw new Error(errorMsg);
                }
                setTemplateNameErr(false);
                setTemplateNameErrMsg("");
                navigate("/templates", { state: { message: "Template saved successfully!" } });
            })
            .catch(error => console.error("Error saving template:", error));
    };


    // table data
    const [tableData, setTableData] = useState([]);
    const [tableCols, setTableCols] = useState([]);
    const [foreignKeys, setForeignKeys] = useState([]); //foreign key details of selected table




    // export things

    const [targetDatabase, setTargetDatabase] = useState("");
    const [targetTable, setTargetTable] = useState("");
    const [dbTables, setDbTables] = useState([]);

    useEffect(() => {
        // fetch tables when targetDatabase changes
        const fetchTables = async () => {
            if (targetDatabase) {
                try {
                    toggleLoading(true);
                    const response = await fetch(`${appAddress}/api/databases/external/tables?name=${encodeURIComponent(targetDatabase)}`, {
                        headers: { Authorization: `Bearer ${token}` },
                        method: 'GET'
                        });
                        if (!response.ok) throw new Error(`Status ${response.status}`);
                        const data = await response.json();
                    setDbTables(Array.isArray(data.tables) ? data.tables : []);
                    console.log("Fetched tables for database", targetDatabase, data.tables);
                } catch (err) {
                    console.error("Failed to fetch databases:", err);
                    setDbTables([]);
                } finally {
                    toggleLoading(false);
                }
                }
        };
        fetchTables();
    }, [targetDatabase]);



     useEffect(() => {
         if (token) {
             getDatabases();
             setSelectedDatabase(""); // reset selected database on token change
         }
         handleMenuToggle();
     }, [token, appAddress]);

    


  // Fetch tables once when token is available
    useEffect(() => {
        if (!token || !selectedDatabase) {
            setTables([]);
            return;
        }

        async function fetchTables() {
            try {
                toggleLoading(true);
                const resource = await fetch(`${appAddress}/api/databases/external/tables?name=${encodeURIComponent(selectedDatabase)}`, {
                    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
                });
                if (!resource.ok) throw new Error(`Status ${resource.status}`);
                const data = await resource.json();
                console.log("Fetched tables:", data);
                // backend may return { driver, tables } or an array
                if (data && typeof data === 'object' && Array.isArray(data.tables)) {
                    setTables(data.tables);
                } else if (Array.isArray(data)) {
                    setTables(data);
                } else {
                    setTables(data?.tables ?? data?.rows ?? []);
                }
            } catch (err) {
                console.error("Failed to fetch tables: ", err);
                setTables([]);
            } finally {
                toggleLoading(false);
            }
        }
        fetchTables();
    }, [token, selectedDatabase, appAddress]);
    
    //gets the selected table's list of columns 
    useEffect(() => {
        if (!selectedTable) return;
 
        async function fetchTableColumns() {
            try {
            setSelectedCols([]);
            setForeignKeysSelection([]);
            setSelectedRFKs([]);
            setSelectedWhere([]);
            toggleLoading(true);
            handleFetchTableData();
            console.log("Fetching columns for table:", selectedTable, "...");
            const res = await fetch(
                `${appAddress}/api/databases/external/tables/${encodeURIComponent(selectedTable)}/columns?name=${encodeURIComponent(selectedDatabase)}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await res.json();
            setTableCols(data.columns);
            setForeignKeys(data.foreignKeys);
            console.log("foreignKeys:", data.foreignKeys);
            console.log(data);
        } catch (error) {
            console.error("Error fetching table columns:", error);
        } finally {
            toggleLoading(false);
            setUpdatedData(false);
        }
        }
        fetchTableColumns();
    }, [selectedTable, token, appAddress, selectedDatabase]);

    useEffect(() => {
            document.title = 'Porter - Table Query Builder';
        }, []);
    

    const [updatedData, setUpdatedData] = useState(false);
    // checks if any of the query-building parameters changed, then alerts the user
    useEffect(() => {
        setUpdatedData(true);
    }, [selectedCols, foreignKeysSelection, selectedWhere, rowLimit, rowLimit]);

     // Fetch data from selected table from selected columns
     async function handleFetchTableData() {
         if (!selectedTable) return;
         try {
            toggleLoading(true);
             // build payload with only present values
            const payload = {};
            if (selectedDatabase) payload.name = selectedDatabase;
            if (rowLimit && Number(rowLimit) > 0) payload.limit = Number(rowLimit);
            if (Array.isArray(selectedCols) && selectedCols.length > 0) payload.columns = selectedCols;
            if (Array.isArray(foreignKeysSelection) && foreignKeysSelection.length > 0) payload.foreign_keys = foreignKeysSelection;
            if (Array.isArray(selectedWhere) && selectedWhere.length > 0) payload.where = selectedWhere;
            console.log('fetch table data payload:', payload);

            // POST to data endpoint for a specific table and include description as query param
            const resource = await fetch(`${appAddress}/api/databases/external/tables/${selectedTable}`, {
                 method: 'POST',
                 headers: {
                     Authorization: `Bearer ${token}`,
                     Accept: 'application/json',
                     'Content-Type': 'application/json',
                 },
                 body: JSON.stringify(payload), // send payload as JSON
             });

            if (!resource.ok) throw new Error(`Error ${resource.status}`);
            const data = await resource.json();

            setShowSuccessGlow(true);
            const SUCCESS_MS = 2000; // match CSS animation duration
            setTimeout(() => setShowSuccessGlow(false), SUCCESS_MS);
            
            // normalize response: API might return { rows: [...] } or an array directly
            const rows = Array.isArray(data) ? data : (data.rows ?? data.data ?? []);
            setTableData(rows);
        } catch (err) {
            console.error("Failed to fetch table data:", err);
        } finally {
            toggleLoading(false);
            setUpdatedData(false);
        }
        }

       


    
    return (
       <>
        <h1 className="title">Table Query Builder </h1>

            <TemplateSideMenu
                isMenuOpen={isMenuOpen}
                selectedTable={selectedTable}
                selectedDatabase={selectedDatabase}
                updatedData={updatedData}
                handleFetchTableData={handleFetchTableData}
                handleMenuToggle={handleMenuToggle}
                templateNameErrMsg={templateNameErrMsg}
                templateNameErr={templateNameErr}
                setTemplateName={setTemplateName}
                templateName={templateName}
                handleSaveTemplate={handleSaveTemplate}
                databases={databases}
                tables={tables}
                setSelectedTable={setSelectedTable}
                menus={menus}
                toggleMenus={toggleMenus}
                resetRules={resetRules}
                rowLimit={rowLimit}
                setRowLimit={setRowLimit}
                tableCols={tableCols}
                foreignKeys={foreignKeys}
                selectedCols={selectedCols}
                selectedRFKs={selectedRFKs}
                selectedColsCount={selectedColsCount}
                selectedRFKsCount={selectedRFKsCount}
                handleChange={handleChange}
                toggle={toggle}
                isToggled={isToggled}
                handleFKSelection={handleFKSelection}
                selectedWhere={selectedWhere}
                WHERE_OPERATORS={WHERE_OPERATORS}
                handleSelectedWhere={handleSelectedWhere}
                handleWhereOperatorChange={handleWhereOperatorChange}
                handleWhereValueChange={handleWhereValueChange}
                exportType={exportType}
                toggleExportType={toggleExportType}
                showWarning={showWarning}
                setShowWarning={setShowWarning}
                populateFindOptions={populateFindOptions}
                loading={loading}
                targetDatabase={targetDatabase}
                setTargetDatabase={setTargetDatabase}
                targetTable={targetTable}
                setTargetTable={setTargetTable}
                dbTables={dbTables}
                addLimitOffset={addLimitOffset}
                handleNewDatabase={handleNewDatabase}
                showColumnWindow={showColumnWindow}
                setShowColumnWindow={setShowColumnWindow}
                setColumnNameChanges={setColumnNameChanges}
                removeFRRule={removeFRRule}
                handleFRRuleChange={handleFRRuleChange}
                limitOffsetRules={limitOffsetRules}
                removeLimitOffsetRule={removeLimitOffsetRule}
                handleLimitOffsetChange={handleLimitOffsetChange}
                columnNameChanges={columnNameChanges}
                toggleLoading={toggleLoading}
                handleColumnNameChange={handleColumnNameChange}
                removeColumnChange={removeColumnChange}
                isAutomated={isAutomated}
                handleAutomationToggle={handleAutomationToggle}
                automationSchedule={automationSchedule}
                setAutomationSchedule={setAutomationSchedule}
                automationPeriod={automationPeriod}
                setAutomationPeriod={setAutomationPeriod}
                automationUnit={automationUnit}
                setAutomationUnit={setAutomationUnit}
            />
            <div className={`main-div`}>
                
                {selectedTable && tableData.length > 0 ? (
                    <div className={`tableContainer ${showSuccessGlow ? "successGlow" : ""}`}>
                        <br />
                        <table id="myTable" border="1" cellPadding="5">
                            <thead>
                                <tr>
                                    {Object.keys(tableData[0]).map((col, idx) => (
                                        <th key={idx}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.map((row, i) => (
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
                    <p className="no-data-message">No database or table selected.</p>
                )}

                
            </div>

            {/* Message modal */}
            <Modal isOpen={isMessageModalOpen} onRequestClose={isMessageModalOpen} contentLabel="Message" className={`message-modal ${messageSuccess ? 'success' : 'error'}`} overlayClassName="none">
                <div style={{ padding: '1rem' }}>
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
                <input type="text" placeholder="Database Name" onChange={(e) => setNewDBName(e.target.value)} />
                <input type="text" placeholder="Description" onChange={(e) => setNewDBdescription(e.target.value)} /> {/* custom description to help identify the database */}
                <select name="driver" id="driver" onChange={(e) => setNewDBDriver(e.target.value)}>
                    <option value="mysql">MySQL</option>
                    <option value="pgsql">PostgreSQL</option>
                    <option value="mariadb">MariaDB</option>
                    <option value="sqlsrv">SQL Server</option>
                    <option value="sqlite">SQLite</option>
                    <option value="oracle">Oracle</option>
                </select>
                <input type="text" placeholder="Host (default: localhost)" onChange={(e) => setNewDBHost(e.target.value)} />
                <input type="text" placeholder="Port (default: 3306)" onChange={(e) => setNewDBPort(e.target.value)} />
                <input type="text" placeholder="Username (default: root)" onChange={(e) => setNewDBUsername(e.target.value)} />
                <input type="password" placeholder="Password" onChange={(e) => setNewDBPassword(e.target.value)} />
                <br />
                <button className="use-button" onClick={() => {handleCreateNewDatabase()}}>Create</button>
                <button className="delete-button" onClick={() => setToggleNewDBModal(false)}>Cancel</button>
            </Modal>
            
            {/* Loading modal */}
            <Modal 
            isOpen={loading} 
            onRequestClose={() => toggleLoading(false)}
            contentLabel="Loading"
            overlayClassName={"modal-overlay"}
            className={"loading-modal"}
            >
                <div className="loader"></div>
            </Modal>
        </>
    )
}