import { useContext, useState, useEffect } from "react"
import { AppContext } from "../../Context/AppContext"
import { useNavigate } from "react-router-dom";
import Modal from 'react-modal';


export default function Database(){

    const { appAddress } = useContext(AppContext);

    const navigate = useNavigate();


    const [loading, toggleLoading] = useState(false);

    //errors, wip
    const [templateNameErr, setTemplateNameErr] = useState(false);
    const [templateNameErrMsg, setTemplateNameErrMsg] = useState("");
    const [message, setMessage] = useState("");
    const [messageSuccess, setMessageSuccess] = useState(false);
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

    const {token, user} = useContext(AppContext);

    // success glow animation trigger, wish it wasnt necessary
    const [showSuccessGlow, setShowSuccessGlow] = useState(false);

    // list of available tables in db
    const [tables, setTables] = useState([]); 
    const [databases, setDatabases] = useState([]); // for future use if internal dbs are added

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
             toggleLoading(false);
             await getDatabases(); // refresh database list
            // prefer selecting by description (backend lookups use description)
            setSelectedDatabase(data.name);
            setToggleNewDBModal(false);
            showMessage("Database created successfully!", true);
         } catch (error) {
             console.error("Error creating new database:", error);
             toggleLoading(false);
             showMessage(`Error creating new database: ${error.message}`, false);
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
    const [rowLimit, setRowLimit] = useState(0);
    const [selectedCols, setSelectedCols] = useState([]);
    const [selectedWhere, setSelectedWhere] = useState([]);
    const [foreignKeysSelection, setForeignKeysSelection] = useState([]); // { parentCol: string, fkTables: { tableName: string, fkColumns: [string] }[] }

    // used for toggling visibility of various sections, also part of template
    const [toggles, setToggles] = useState({}); // { id: bool }
    // selected referenced foreign keys stored per parent FK constraint: { [parentCol]: [fkColumnName] }
    const [selectedRFKs, setSelectedRFKs] = useState({}); // { parentCol: [fkcol, ...] }
    const [toggleNewDBModal, setToggleNewDBModal] = useState(false);


    // table data
    const [tableData, setTableData] = useState([]);
    const [tableCols, setTableCols] = useState([]);
    const [foreignKeys, setForeignKeys] = useState([]); //foreign key details of selected table



    // available operators
    const WHERE_OPERATORS = [
      '=', '!=', '<', '<=', '>', '>=',
      'LIKE', 'NOT LIKE', 'IN', 'NOT IN',
      'IS NULL', 'IS NOT NULL'
    ];

    const toggle = (id) => {
        setToggles((prev) => ({
        ...prev,
        [id]: !prev[id], // flip the bool for that id
        }));
    };

    const isToggled = (id) => !!toggles[id]; // helper for readability\

    function handleNewDatabase($database) {
        if ($database !== "New Database") {
            setSelectedDatabase($database);
            setTableCols([]);
            setTableData([]);
            setSelectedCols([]);
            return
        }
        setToggleNewDBModal(true);
    
    }


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
     useEffect(() => {
         if (token) {
             getDatabases();
             setSelectedDatabase(""); // default for now, later can add internal db support
         }
     }, [token]);

    // manage FKSelection: { parentCol: string, fkTables: { tableName: string, fkColumns: [string] }[] }
    function handleFKSelection(parentCol, tableName, fkColumn) {
        

        // handles the checkboxes for foreign key columns, but scoped to the parent FK (constraint)
        setSelectedRFKs((prev) => {
            const copy = { ...prev };
            const list = Array.isArray(copy[parentCol]) ? [...copy[parentCol]] : [];
            const idx = list.indexOf(fkColumn);
            if (idx === -1) {
                // add
                list.push(fkColumn);
            } else {
                // remove
                list.splice(idx, 1);
            }
            if (list.length) copy[parentCol] = list;
            else delete copy[parentCol];
            return copy;
        });


        setForeignKeysSelection((prev) => {
            // deep-copy prev structure (shallow copies are enough for our nested arrays/objects)
            const copy = prev.map(p => ({
                parentCol: p.parentCol,
                fkTables: p.fkTables.map(t => ({ tableName: t.tableName, fkColumns: [...t.fkColumns] }))
            }));

            const parentIdx = copy.findIndex(p => p.parentCol === parentCol);

            if (parentIdx === -1) {
                // parent entry doesn't exist -> create it with one table and one column
                return [
                    ...copy,
                    { parentCol, fkTables: [{ tableName, fkColumns: [fkColumn] }] }
                ];
            }

            const parent = copy[parentIdx];
            const tableIdx = parent.fkTables.findIndex(t => t.tableName === tableName);

            if (tableIdx === -1) {
                // table entry doesn't exist -> add it with the column
                parent.fkTables.push({ tableName, fkColumns: [fkColumn] });
            } else {
                const table = parent.fkTables[tableIdx];
                const colIdx = table.fkColumns.indexOf(fkColumn);

                if (colIdx === -1) {
                    // add column
                    table.fkColumns.push(fkColumn);
                } else {
                    // remove column
                    table.fkColumns.splice(colIdx, 1);
                    // if table has no columns left, remove the table entry
                    if (table.fkColumns.length === 0) {
                        parent.fkTables.splice(tableIdx, 1);
                    }
                }
            }

            // if parent has no fkTables left, remove the parent entry
            if (parent.fkTables.length === 0) {
                copy.splice(parentIdx, 1);
            }
            // console.log("copy", copy);
            return copy;
        });
    }


  // Fetch tables once when token is available
    useEffect(() => {
        if (!token || !selectedDatabase) {
            setTables([]);
            return;
        }

        async function fetchTables() {
            try {
                const resource = await fetch(`${appAddress}/api/databases/external/tables?name=${selectedDatabase}`, {
                    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
                });
                if (!resource.ok) throw new Error(`Status ${resource.status}`);
                const data = await resource.json();
                console.log("Fetched tables:", data);
                setTables(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Failed to fetch tables: ", err);
                setTables([]);
            }
        }
        fetchTables();
    }, [token, selectedDatabase]);
    
    //gets the selected table's list of columns 
    useEffect(() => {
        if (!selectedTable) return;
 
        async function fetchTableColumns() {
            setSelectedCols([]);
            setForeignKeysSelection([]);
            setSelectedRFKs([]);
            setSelectedWhere([]);
            const res = await fetch(
                `${appAddress}/api/databases/external/tables/${encodeURIComponent(selectedTable)}/columns?name=${encodeURIComponent(selectedDatabase)}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await res.json();
            setTableCols(data.columns);
            setForeignKeys(data.foreignKeys);
            // console.log("foreignKeys:", data.foreignKeys);
            // console.log(data);
        }
        fetchTableColumns();
    }, [selectedTable, token]);

    useEffect(() => {
            document.title = 'Porter - Table Query Builder';
        }, []);
    


     // Fetch data from selected table from selected columns
     async function handleFetchTableData() {
         if (!selectedTable) return;
         try {
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
        }
        }

       


    //chganes selectedCols when a checkbox is checked or unchecked
    const handleChange = (col) => {
        setSelectedCols((prev) =>
        prev.includes(col)
            ? prev.filter((c) => c !== col) // remove if already selected
            : [...prev, col] // add if not selected
        );
    };


    // handle changes for the dynamic WHERE selects
    // e: event, idx: index of the select being changed (the extra blank select has idx === current selectedWhere.length)
    const handleSelectedWhere = (e, idx) => {
        const val = e.target.value;
        setSelectedWhere((prev = []) => {
            const copy = [...prev];

            // adding from the extra blank select
            if (idx === copy.length) {
                if (!val) return copy; // nothing chosen -> no change
                // add new selected column with default operator and empty value
                return [...copy, { column: val, operator: '=', value: '' }];
            }

            // updating an existing select's column
            if (!val) {
                // cleared the select -> remove it unless it's the only one
                if (copy.length > 1) {
                    copy.splice(idx, 1);
                    return copy;
                }
                // last one cleared -> keep empty state
                return [];
            }

            // replace column while keeping operator/value
            copy[idx] = { ...(copy[idx] || {}), column: val, operator: copy[idx]?.operator ?? '=', value: copy[idx]?.value ?? '' };
            return copy;
        });
    };

    // change operator for a given where row
    const handleWhereOperatorChange = (idx, operator) => {
        setSelectedWhere((prev = []) => {
            const copy = [...prev];
            if (!copy[idx]) return copy;
            copy[idx] = { ...copy[idx], operator };
            // if operator is IS NULL / IS NOT NULL, clear value
            if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
                copy[idx].value = '';
            }
            return copy;
        });
    };

    // change input value for a given where row
    const handleWhereValueChange = (idx, value) => {
        setSelectedWhere((prev = []) => {
            const copy = [...prev];
            if (!copy[idx]) return copy;
            copy[idx] = { ...copy[idx], value };
            return copy;
        });
    };

    const handleSaveTemplate = () => {
        const templateName = document.getElementById("templateName").value;
        
        // Save the template (you'll need to implement this)
        console.log("Saving template:", templateName);
        setTemplateNameErr(false);

        let query = {};

        if (Array.isArray(selectedCols) && selectedCols.length > 0) query.columns = selectedCols;
        if (Array.isArray(foreignKeysSelection) && foreignKeysSelection.length > 0) query.foreign_keys = foreignKeysSelection;
        if (Array.isArray(selectedWhere) && selectedWhere.length > 0) query.where = selectedWhere;
        if (Object.keys(query).length === 0) {
           query.columns = ["*"];
       }

        console.log(query);
        
        let UI = {
            toggles,
            selectedRFKs
        }

        const payload = {
            name: templateName,
            query: query,
            database: selectedDatabase, // hardcoded for now, later can add internal db support
            table: selectedTable,
            user_id: user.id,
            UI: UI
        };
        console.log("Payload for saving template:", payload);

        fetch(`${appAddress}/api/query-templates`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                // Handle HTTP error responses
                const errorMsg = data?.message || "An error occurred";
                setTemplateNameErr(true);
                setTemplateNameErrMsg(errorMsg);
                throw new Error(errorMsg);
            }
            setTemplateNameErr(false);
            setTemplateNameErrMsg("");
            console.log("Template saved successfully:", data);
            // Handle success (e.g., show a success message)
            navigate("/templates", { state: { message: "Template saved successfully!" } });
        })
        .catch(error => {
            console.error("Error saving template:", error);
        });
    }

    return (
       <>
        <h1 className="title">Table Query Builder</h1>
        
            <div className={`main-div`}>
                
                <div style={{width: "50%", margin: "auto auto 20px auto" }}>
                    <label htmlFor="db">Select Database</label>
                    <select id="db" value={selectedDatabase} onChange={(e) => handleNewDatabase(e.target.value)}>
                        <option value="">Choose a database</option>
                        {databases.map((db, index) => (
                            // backend returns objects like { identifier , name } — support both shapes
                            <option key={index} value={typeof db === 'string' ? db : (db.description ?? db.name ?? JSON.stringify(db))}>
                                {typeof db === 'string' ? db : (db.name ?? db.description ?? JSON.stringify(db))}
                            </option>
                        ))}
                        <option value="New Database" style={{ fontWeight: "bold" }}>+New Database</option>
                    </select>
                    {Array.isArray(tables) && tables.length > 0 && (
                        <>
                            <label htmlFor="table-select">Select a table</label>
                            <select id="table-select" value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)}>
                                <option value="">Choose a table</option>
                                {tables.map((t, index) => {
                                    // support different shapes returned by backend (string or object)
                                    const tableName = typeof t === 'string' ? t : (Object.values(t)[0] ?? JSON.stringify(t));
                                    return <option key={index} value={tableName}>{tableName}</option>;
                         })}
                    </select>
                        </>
                    )}
                    
                    
                </div>

                <div className="filterDIV">
                    {tableCols.length > 0 && (
                        <div className="filterDIVenabled">
                            <button onClick={() => toggle("column-checklist")}> {isToggled("column-checklist") ? "▲" : "▼"} Select columns</button> <br />
                            {isToggled("column-checklist") && (
                                <div id="column-checklist" className="column-checklist">

                                    {/* List of columns with checkboxes */}
                                    {tableCols.map((col) => {
                                        // Find the foreign key object for this column, if any
                                        const fk = Object.values(foreignKeys).find(fk => fk.column_name === col);
                                        return (
                                            <div key={col} className="column-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCols.includes(col)}
                                                        onChange={() => handleChange(col)}
                                                    />
                                                    {col}
                                                    {fk && (
                                                        <label
                                                            onClick={() => toggle(fk.constraint_name)}
                                                            style={{ cursor: "pointer", marginLeft: "8px" }}
                                                        >
                                                        {isToggled(fk.constraint_name) ? "-" : "+"}
                                                        </label>
                                                    )}
                                                </label>
                                                {/* Show referenced table(s) if this column is a foreign key */}
                                                {fk && isToggled(fk.constraint_name) && (
                                                <div className="nested" style={{ marginLeft: "16px" }}>
                                                    <label
                                                        onClick={() => toggle(`${fk.constraint_name}-table`)}
                                                    >
                                                        <strong>{fk.referenced_table}</strong> {isToggled(`${fk.constraint_name}-table`) ? "-" : "+"}
                                                    </label>
                                                    {isToggled(`${fk.constraint_name}-table`) && (
                                                        <div style={{ marginLeft: "16px" }}>
                                                            {fk.referenced_table_columns.map((fkcol, i) =>
                                                                fkcol === fk.referenced_column ? null : (
                                                                    <div key={i} className="fk-details">
                                                                        <label>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={Array.isArray(selectedRFKs[fk.column_name]) && selectedRFKs[fk.column_name].includes(fkcol)}
                                                                                onChange={() => handleFKSelection(fk.column_name, fk.referenced_table, fkcol)}
                                                                            />
                                                                            {fkcol}
                                                                        </label>
                                                                    </div>
                                                                ))}
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
                                    // include referenced FK columns as "referencedTable.column"
                                    const fkList = Array.isArray(foreignKeys) ? foreignKeys : Object.values(foreignKeys || {});
                                    const fkOptions = fkList.flatMap(fk =>
                                        Array.isArray(fk.referenced_table_columns)
                                            ? fk.referenced_table_columns
                                                .filter(c => c !== fk.referenced_column) // keep same behavior if desired
                                                .map(c => `${fk.referenced_table}.${c}`)
                                            : []
                                    );
                                    // combine and dedupe
                                    const combinedOptions = Array.from(new Set([...(Array.isArray(tableCols) ? tableCols : Object.keys(tableCols || {})), ...fkOptions]));
                                    const optionsList = combinedOptions;
                                    const selected = Array.isArray(selectedWhere) ? selectedWhere : [];
 
                                     return (
                                         <>
                                            {/* render selects for each current selection (selected is array of {column, operator, value}) */}
                                            {selected.map((row, idx) => {
                                                const currentCol = row?.column ?? '';
                                                // show the current value even if it's excluded from the global selected list
                                                const opts = optionsList.filter(o => o === currentCol || !selected.some(s => s.column === o));
                                                 return (
                                                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                                        <select value={currentCol} onChange={(e) => handleSelectedWhere(e, idx)} >
                                                            <option value="">-- Choose Column --</option>
                                                            {opts.map((col) => <option key={col} value={col}>{col}</option>)}
                                                        </select>

                                                        {/* operator select - only show when a column is chosen */}
                                                        {currentCol && (
                                                            <select
                                                                value={row.operator ?? '='}
                                                                onChange={(e) => handleWhereOperatorChange(idx, e.target.value)}
                                                            >
                                                                {WHERE_OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                                                            </select>
                                                        )}

                                                        {/* value input - show when a column chosen and operator expects a value */}
                                                        {currentCol && !(row.operator === 'IS NULL' || row.operator === 'IS NOT NULL') && (
                                                            <input
                                                                type="text"
                                                                placeholder="value"
                                                                value={row.value ?? ''}
                                                                onChange={(e) => handleWhereValueChange(idx, e.target.value)}
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {/* extra blank select to add another condition (excludes already chosen options) */}
                                            <select key="extra" value="" className="blankSelect" onChange={(e) => handleSelectedWhere(e, selected.length)}>
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
                            <input type="number" id="limit" placeholder="Input row amount" onChange={(e) => {setRowLimit(e.target.value)}} style={{fontSize:"20px"}}/> <br />
                                <br /> 
                                <button onClick={handleFetchTableData}>Load Data</button>
                            </div>
                    
                    )}
                </div>
                {selectedTable && tableData.length > 0 && (
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
                )}

                {tableData.length != 0 && (
                    <div style={{ marginTop: '20px', fontStyle: 'italic' }}>
                        <label htmlFor="templateName"> Template Name: </label>
                        <p className="error">{templateNameErrMsg}</p>
                        <input type="text" name="templateName" id="templateName" style={{ borderColor: templateNameErr ? 'red' : 'initial' , width: '30%', marginBottom: '10px' }} />
                        <button onClick={handleSaveTemplate} > Save Template </button>
                    </div>
                )}
            </div>

            {/* Message modal */}
            <Modal isOpen={isMessageModalOpen} onRequestClose={isMessageModalOpen} contentLabel="Message" className={`message-modal ${messageSuccess ? 'success' : 'error'}`} overlayClassName="none">
                <div style={{ padding: '1rem' }}>
                    <p>{message}</p>
                </div>
            </Modal>

            <Modal 
            isOpen={toggleNewDBModal} 
            onRequestClose={() => setToggleNewDBModal(false)}
            contentLabel="Create New Database"
            overlayClassName={"modal-overlay"}
            className={"newDB-modal"}
            >
                <h2>Create New Database</h2>
                <input type="text" placeholder="Database Name" onChange={(e) => setNewDBName(e.target.value)} />
                <input type="text" placeholder="Description" onChange={(e) => setNewDBdescription(e.target.value)} /> {/* custom description to distinguish database, easier for users*/}
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