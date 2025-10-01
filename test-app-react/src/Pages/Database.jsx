import { useContext, useState, useEffect } from "react"
import { AppContext } from "../Context/AppContext"
import { Navigate } from "react-router-dom";


export default function Database(){

    const {token, user} = useContext(AppContext);

    const [tables, setTables] = useState([]); 
    const [selectedTable, setSelectedTable] = useState("");
    const [tableData, setTableData] = useState([]);
    const [rowLimit, setRowLimit] = useState(0);

    const [tableCols, setTableCols] = useState([]);
    const [selectedCols, setSelectedCols] = useState([]);
    // const [checkListShown, toggleChecklist] = useState(false);

    const [toggles, setToggles] = useState({}); // { id: bool }

    const toggle = (id) => {
        setToggles((prev) => ({
        ...prev,
        [id]: !prev[id], // flip the bool for that id
        }));
    };

    const isToggled = (id) => !!toggles[id]; // helper for readability

    const [foreignKeys, setForeignKeys] = useState([]); 
    const [referencedTables, setReferencedTables] = useState({}); // { columnName: referencedTableName }

    const [FKSelection, setFKSelection] = useState([]); // { parentCol: string, fkTables: { tableName: string, fkColumns: [string] }[] }
    const [selectedFKTables, setSelectedFKTables] = useState([]); // selected referenced foreign key tables
    // selected referenced foreign keys stored per parent FK constraint: { [parentCol]: [fkColumnName] }
    const [selectedRFKs, setSelectedRFKs] = useState({}); // { parentCol: [fkcol, ...] }




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


        setFKSelection((prev) => {
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
        if (!token) return;

        async function fetchTables() {
            try {
                const resource = await fetch("http://127.0.0.1:8000/api/databases/external/tables", {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                }
                });
                const data = await resource.json();
                setTables(data);
            } catch (err) {
                console.error("Failed to fetch tables: ", err);
            }
            }
        fetchTables();
    }, [token]);

    
    //gets the selected table's list of columns 
    useEffect(() => {
        if (!selectedTable) return;

        async function fetchTableColumns() {
            setSelectedCols([]);
            setFKSelection([]);
            setSelectedRFKs([]);
            const res = await fetch(
            `http://127.0.0.1:8000/api/databases/external/tables/${selectedTable}/columns`,
            { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await res.json();
            setTableCols(data.columns);
            setForeignKeys(data.foreignKeys);
            console.log(data.foreignKeys.SYS_TEXT_ID);
            // console.log(data);
        }
        fetchTableColumns();
    }, [selectedTable, token]);
    


     // Fetch data from selected table from selected columns
    async function handleFetchTableData() {
        if (!selectedTable) return;
        try {
            // build payload with only present values
            const payload = {};
            if (rowLimit && Number(rowLimit) > 0) payload.limit = Number(rowLimit);
            if (Array.isArray(selectedCols) && selectedCols.length > 0) payload.columns = selectedCols;
            if (Array.isArray(FKSelection) && FKSelection.length > 0) payload.selection = FKSelection;

            console.log('fetch table data payload:', payload);

            const resource = await fetch(`http://127.0.0.1:8000/api/databases/external/tables/${selectedTable}`, {
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


    


    
    
    

    return (
        <>
        
        {user ? (
            <div className="main-div">
                <div>
                    <label htmlFor="table-select">Select a table</label>
                    <select id="table-select" value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)}>
                        <option value="">Choose a table</option>
                        {tables.map((t, index) => {
                            const tableName = Object.values(t)[0];
                            return (
                                <option key={index} value={tableName}>{tableName}</option>
                            )
                        })}
                    </select>

                    
                </div>

                {tableCols.length > 0 && (
                    <div>
                        <button onClick={() => toggle("column-checklist")}> {isToggled("column-checklist") ? "▲" : "▼"} Select columns</button> <br />
                    {isToggled("column-checklist") && (
                        
                        <div id="column-checklist" className="column-checklist">

                            {/* List of columns with checkboxes */}
                        {tableCols.map((col) => {
                            // Find the foreign key object for this column, if any
                            const fk = Object.values(foreignKeys).find(fk => fk.constraint_name === col);
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
                                                                        checked={Array.isArray(selectedRFKs[fk.constraint_name]) && selectedRFKs[fk.constraint_name].includes(fkcol)}
                                                                        onChange={() => handleFKSelection(fk.constraint_name, fk.referenced_table, fkcol)}
                                                                    />
                                                                    {fkcol}
                                                                </label>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                    </div>
                    ) }
                    
                    {/* <p>Selected: {selectedCols.join(", ")}</p> */}

                    </div>
                )}
                <br /><br />
                <input type="number" id="limit" placeholder="Input row amount" onChange={(e) => {setRowLimit(e.target.value)}} style={{fontSize:"20px"}}/> <br />
                    <br />
                    <button onClick={handleFetchTableData}>Load Data</button>

                {tableData.length > 0 && (
                    <div className="tableContainer">
                        <table border="1" cellPadding="5">
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
            </div>
        ) : (
            <Navigate to="/" replace />
        )}
        </>
    )
}