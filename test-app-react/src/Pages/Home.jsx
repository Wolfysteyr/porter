import { useEffect, useState, useContext } from "react";
import { AppContext } from "../Context/AppContext";

export default function Home() {
  const { token, user } = useContext(AppContext);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [tableData, setTableData] = useState([]);

  // Fetch available tables on load
  useEffect(() => {
    async function fetchTables() {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/databases/external/tables", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        setTables(data);
      } catch (err) {
        console.error("Failed to fetch tables:", err);

        
      }
    }

    async function fetchTableData() {
        if (!selectedTable || !selectedDb) return;

        const columnQuery = selectedColumns.length > 0 
            ? `?columns=${selectedColumns.join(",")}`
            : "";

        const res = await fetch(
            `/api/databases/${selectedDb}/tables/${selectedTable}/data${columnQuery}`,
            {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/json",
            },
            }
        );

        const data = await res.json();
        setTableData(data);
        }


 function TableSelector({ token, selectedDb, selectedTable }) {
  const [columns, setColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);

  async function fetchColumns() {
    const res = await fetch(`/api/databases/${selectedDb}/tables/${selectedTable}/columns`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
    });
    const data = await res.json();
    setColumns(data);
  }

  function toggleColumn(col) {
    setSelectedColumns(prev =>
      prev.includes(col)
        ? prev.filter(c => c !== col)
        : [...prev, col]
    );
  }

  return (
    <div>
      <button onClick={fetchColumns}>Load Columns</button>

      <ul>
        {columns.map(col => (
          <li key={col}>
            <label>
              <input
                type="checkbox"
                checked={selectedColumns.includes(col)}
                onChange={() => toggleColumn(col)}
              />
              {col}
            </label>
          </li>
        ))}
      </ul>

      <pre>Selected: {JSON.stringify(selectedColumns, null, 2)}</pre>
    </div>
  );
}


    if (token) fetchTables();
  }, [token]);

  // Fetch data from selected table
  async function handleFetchTableData() {
    if (!selectedTable) return;

    try {
      const res = await fetch(`"http://127.0.0.1:8000/api/databases/external/tables/${selectedTable}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setTableData(data);
    } catch (err) {
      console.error("Failed to fetch table data:", err);
    }
  }

  return (
    <div className="home">
      {user ? (
        <>
          <h2>Welcome, {user.name}!</h2>

          <div>
            <label htmlFor="table-select">Select a table: </label>
            <select
              id="table-select"
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
            >
              <option value="">--Choose a table--</option>
              {tables.map((t, index) => {
                // Each DB driver may name the "table" column differently
                const tableName = Object.values(t)[0];
                return (
                  <option key={index} value={tableName}>
                    {tableName}
                  </option>
                );
              })}
            </select>
            <button onClick={handleFetchTableData}>Load Data</button>
          </div>

          {tableData.length > 0 && (
            <table border="1" cellPadding="5" style={{ marginTop: "20px" }}>
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
          )}
        </>
      ) : (
        <h2>Please log in to access the database.</h2>
      )}
    </div>
  );
}
