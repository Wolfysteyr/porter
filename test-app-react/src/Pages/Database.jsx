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
            const res = await fetch(
            `http://127.0.0.1:8000/api/databases/external/tables/${selectedTable}/columns`,
            { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await res.json();
            setTableCols(data);
            // console.log(data);
        }
        fetchTableColumns();
    }, [selectedTable]);
    


     // Fetch data from selected table from selected columns
    async function handleFetchTableData() {
        if (!selectedTable) return;
        let columns = "";
        try {
            if(selectedCols){
                columns = `&columns=${selectedCols.join(",")}`;
            }

            console.log(columns);
            const resource = await fetch(`http://127.0.0.1:8000/api/databases/external/tables/${selectedTable}?limit=${rowLimit}${columns}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                },
            });
            if (!resource.ok) throw new Error(`Error ${resource.status}`);
            const data = await resource.json();
            setTableData(data);
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
                    <h3>Select columns</h3>
                    <div className="column-checklist">
                        {tableCols.map((col) => (
                            <div key={col}>
                                <label>
                                    <input type="checkbox" checked={selectedCols.includes(col)}
                                    onChange={() => handleChange(col)}/>
                                    {col}    
                                </label>  
                            </div>
                        ))}

                    </div>
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