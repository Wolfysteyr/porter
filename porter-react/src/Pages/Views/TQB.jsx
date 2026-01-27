import { useContext, useEffect } from "react"
import { AppContext } from "../../Context/AppContext"
import { useNavigate } from "react-router-dom";
import Modal from 'react-modal';
import TemplateSideMenu from "../../Components/TemplateSideMenu";
import { useQueryBuilder } from "../../hooks/useQueryBuilder";





export default function TQB() {
    const { appAddress, token, user } = useContext(AppContext);
    const navigate = useNavigate();
    const qb = useQueryBuilder({ appAddress, token, user, navigate });

    useEffect(() => {
        if (token) {
            qb.getDatabases();
            qb.setSelectedDatabase("");
        }
        qb.handleMenuToggle();
        // eslint-disable-next-line
    }, [token, appAddress]);

    useEffect(() => {
        document.title = 'Porter - Table Query Builder';
    }, []);

    // Fetch tables when targetDatabase changes
    useEffect(() => {
        const fetchTables = async () => {
            if (qb.targetDatabase) {
                try {
                    qb.toggleLoading(true);
                    const response = await fetch(`${appAddress}/api/databases/external/tables?name=${encodeURIComponent(qb.targetDatabase)}`, {
                        headers: { Authorization: `Bearer ${token}` },
                        method: 'GET'
                    });
                    if (!response.ok) throw new Error(`Status ${response.status}`);
                    const data = await response.json();
                    qb.setDbTables(Array.isArray(data.tables) ? data.tables : []);
                } catch (err) {
                    qb.setDbTables([]);
                } finally {
                    qb.toggleLoading(false);
                }
            }
        };
        fetchTables();
        // eslint-disable-next-line
    }, [qb.targetDatabase]);

    // Fetch tables for selectedDatabase
    useEffect(() => {
        if (!token || !qb.selectedDatabase) {
            qb.setTables([]);
            return;
        }
        async function fetchTables() {
            try {
                qb.toggleLoading(true);
                const resource = await fetch(`${appAddress}/api/databases/external/tables?name=${encodeURIComponent(qb.selectedDatabase)}`, {
                    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
                });
                if (!resource.ok) throw new Error(`Status ${resource.status}`);
                const data = await resource.json();
                if (data && typeof data === 'object' && Array.isArray(data.tables)) {
                    qb.setTables(data.tables);
                } else if (Array.isArray(data)) {
                    qb.setTables(data);
                } else {
                    qb.setTables(data?.tables ?? data?.rows ?? []);
                }
            } catch (err) {
                qb.setTables([]);
            } finally {
                qb.toggleLoading(false);
            }
        }
        fetchTables();
        // eslint-disable-next-line
    }, [token, qb.selectedDatabase, appAddress]);

    // Fetch columns for selectedTable
    useEffect(() => {
        if (!qb.selectedTable) return;
        async function fetchTableColumns() {
            try {
                qb.setSelectedCols([]);
                qb.setForeignKeysSelection([]);
                qb.setSelectedRFKs([]);
                qb.setSelectedWhere([]);
                qb.toggleLoading(true);
                // Optionally: fetch table data here if needed
                const res = await fetch(
                    `${appAddress}/api/databases/external/tables/${encodeURIComponent(qb.selectedTable)}/columns?name=${encodeURIComponent(qb.selectedDatabase)}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const data = await res.json();
                qb.setTableCols(data.columns);
                qb.setForeignKeys(data.foreignKeys);
                qb.handleFetchTableData();
            } catch (error) {
                // handle error
            } finally {
                qb.toggleLoading(false);
                qb.setUpdatedData(false);
            }
        }
        fetchTableColumns();
        // eslint-disable-next-line
    }, [qb.selectedTable, token, appAddress, qb.selectedDatabase]);

    useEffect(() => {
        qb.setUpdatedData(true);
        // eslint-disable-next-line
    }, [qb.selectedCols, qb.foreignKeysSelection, qb.selectedWhere, qb.rowLimit]);

    // TemplateSideMenu logic is now in qb
    return (
        <>
            <h1 className="title">Table Query Builder </h1>
            <TemplateSideMenu
                {...qb}
                handleFetchTableData={qb.handleFetchTableData}
                populateFindOptions={() => {}}
                handleSaveTemplate={() => {qb.handleSaveTemplate()}}
                isEditing={false}
            />
            <div className={`main-div`}>
                {qb.selectedTable && qb.tableData.length > 0 ? (
                    <div className={`tableContainer ${qb.showSuccessGlow ? "successGlow" : ""}`}>
                        <br />
                        <table id="myTable" border="1" cellPadding="5">
                            <thead>
                                <tr>
                                    {Object.keys(qb.tableData[0]).map((col, idx) => (
                                        <th key={idx}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {qb.tableData.map((row, i) => (
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
            <Modal isOpen={qb.isMessageModalOpen} onRequestClose={qb.isMessageModalOpen} contentLabel="Message" className={`message-modal ${qb.messageSuccess ? 'success' : 'error'}`} overlayClassName="none">
                <div style={{ padding: '1rem' }}>
                    <p>{qb.message}</p>
                </div>
            </Modal>
            {/* New Database modal */}
            <Modal 
                isOpen={qb.toggleNewDBModal} 
                onRequestClose={() => qb.setToggleNewDBModal(false)}
                contentLabel="Create New Database"
                overlayClassName={"modal-overlay"}
                className={"newDB-modal"}
            >
                <h2>Create New Database</h2>
                <input type="text" placeholder="Database Name" onChange={(e) => qb.setNewDBName(e.target.value)} />
                <input type="text" placeholder="Description" onChange={(e) => qb.setNewDBdescription(e.target.value)} />
                <select name="driver" id="driver" onChange={(e) => qb.setNewDBDriver(e.target.value)}>
                    <option value="mysql">MySQL</option>
                    <option value="pgsql">PostgreSQL</option>
                    <option value="mariadb">MariaDB</option>
                    <option value="sqlsrv">SQL Server</option>
                    <option value="sqlite">SQLite</option>
                    <option value="oracle">Oracle</option>
                </select>
                <input type="text" placeholder="Host (default: localhost)" onChange={(e) => qb.setNewDBHost(e.target.value)} />
                <input type="text" placeholder="Port (default: 3306)" onChange={(e) => qb.setNewDBPort(e.target.value)} />
                <input type="text" placeholder="Username (default: root)" onChange={(e) => qb.setNewDBUsername(e.target.value)} />
                <input type="password" placeholder="Password" onChange={(e) => qb.setNewDBPassword(e.target.value)} />
                <br />
                <button className="use-button" onClick={qb.handleCreateNewDatabase}>Create</button>
                <button className="delete-button" onClick={() => qb.setToggleNewDBModal(false)}>Cancel</button>
            </Modal>
            {/* Loading modal */}
            <Modal 
                isOpen={qb.loading} 
                onRequestClose={() => qb.toggleLoading(false)}
                contentLabel="Loading"
                overlayClassName={"modal-overlay"}
                className={"loading-modal"}
            >
                <div className="loader"></div>
            </Modal>
        </>
    );
}