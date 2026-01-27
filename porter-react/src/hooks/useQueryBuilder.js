import { useState, useEffect, useCallback, useRef, act } from "react";

export function useQueryBuilder({
    appAddress,
    token,
    user,
    navigate,
    template = {},
    closeEditModal = () => {},
}) {
    // UI
    const [loading, toggleLoading] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const [showSuccessGlow, setShowSuccessGlow] = useState(false);
    const [showColumnWindow, setShowColumnWindow] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [menus, setMenus] = useState({});
    const [toggleNewDBModal, setToggleNewDBModal] = useState(false);
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [toggles, setToggles] = useState({});
    const [selectedRFKs, setSelectedRFKs] = useState(() => {
        if (!Array.isArray(template.query?.foreign_keys)) return {};

        return template.query.foreign_keys.reduce((acc, fk) => {
            if (!fk.parentCol || !Array.isArray(fk.fkTables)) return acc;

            const cols = fk.fkTables.flatMap((t) =>
                Array.isArray(t.fkColumns) ? t.fkColumns : [],
            );

            if (cols.length) acc[fk.parentCol] = cols;

            return acc;
        }, {});
    });

    const isHydratingTemplate = useRef(false);

    // Modal & Message
    const [message, setMessage] = useState("");
    const [messageSuccess, setMessageSuccess] = useState(false);

    // Database Connection
    const [databases, setDatabases] = useState([]);
    const [newDBName, setNewDBName] = useState("");
    const [newDBdescription, setNewDBdescription] = useState("");
    const [newDBDriver, setNewDBDriver] = useState("mysql");
    const [newDBHost, setNewDBHost] = useState("localhost");
    const [newDBPort, setNewDBPort] = useState("3306");
    const [newDBUsername, setNewDBUsername] = useState("");
    const [newDBPassword, setNewDBPassword] = useState("");

    // Query Builder
    const [tables, setTables] = useState([]);
    const [selectedDatabase, setSelectedDatabase] = useState(
        template.database || "",
    );
    const [selectedTable, setSelectedTable] = useState(template.table || "");
    const [rowLimit, setRowLimit] = useState("");
    const [selectedCols, setSelectedCols] = useState(
        template.query?.columns || [],
    );
    const [selectedWhere, setSelectedWhere] = useState(
        template.query?.where || [],
    );
    const [foreignKeysSelection, setForeignKeysSelection] = useState(
        template.query?.foreign_keys || [],
    );
    const [tableData, setTableData] = useState([]);
    const [editTableData, setEditTableData] = useState([]);
    const [tableCols, setTableCols] = useState([]);
    const [foreignKeys, setForeignKeys] = useState([]);
    const [updatedData, setUpdatedData] = useState(false);

    // Template/Export/Automation
    const [templateName, setTemplateName] = useState(template.name || "");
    const [templateNameErr, setTemplateNameErr] = useState(false);
    const [templateNameErrMsg, setTemplateNameErrMsg] = useState("");
    const [exportType, setExportType] = useState(
        template.export?.exportType || false,
    ); // false = CSV, true = SQL
    const [columnNameChanges, setColumnNameChanges] = useState(
        template.export?.columnNameChanges || [],
    );
    const [FRRules, setFRRules] = useState(
        template.export?.findReplaceRules || [],
    );
    const [limitOffsetRules, setLimitOffsetRules] = useState(
        template.export?.limitOffsetRules || [],
    );

    // Export Target
    const [targetDatabase, setTargetDatabase] = useState("");
    const [targetTable, setTargetTable] = useState("");
    const [dbTables, setDbTables] = useState([]);

    // Keep internal state in sync when the provided `template` changes
    useEffect(() => {
        if (!template || Object.keys(template).length === 0) return;

        // Prevent overwriting user changes if they are already editing
        isHydratingTemplate.current = true;

        setSelectedDatabase(template.database || "");
        setSelectedTable(template.table || "");
        setSelectedCols(template.query?.columns || []);
        setSelectedWhere(template.query?.where || []);
        setForeignKeysSelection(template.query?.foreign_keys || []);

        setTemplateName(template.name || "");
        setExportType(Boolean(template.export?.exportType));
        setColumnNameChanges(
            Array.isArray(template.export?.columnNameChanges)
                ? template.export.columnNameChanges
                : [],
        );
        setFRRules(
            Array.isArray(template.export?.findReplaceRules)
                ? template.export.findReplaceRules
                : [],
        );
        setLimitOffsetRules(
            Array.isArray(template.export?.limitOffsetRules)
                ? template.export.limitOffsetRules
                : [],
        );
        const fkMap = Array.isArray(template.query?.foreign_keys)
            ? template.query.foreign_keys.reduce((acc, fk) => {
                  if (!fk.parentCol || !Array.isArray(fk.fkTables)) return acc;

                  const cols = fk.fkTables.flatMap((t) =>
                      Array.isArray(t.fkColumns) ? t.fkColumns : [],
                  );

                  if (cols.length) acc[fk.parentCol] = cols;

                  return acc;
              }, {})
            : {};

        setSelectedRFKs(fkMap);
    }, [template]);

    // Derived Values for UI
    const selectedColsCount = Array.isArray(selectedCols)
        ? selectedCols.length
        : 0;
    const selectedRFKsCount =
        selectedRFKs && typeof selectedRFKs === "object"
            ? Object.values(selectedRFKs).reduce(
                  (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
                  0,
              )
            : 0;

    // Logic functions (moved from TQB.jsx)

    // Save template logic
    function handleSaveTemplate() {
        setTemplateNameErr(false);

        let query = {};
        if (Array.isArray(selectedCols) && selectedCols.length > 0)
            query.columns = selectedCols;

        if (
            Array.isArray(foreignKeysSelection) &&
            foreignKeysSelection.length > 0
        ) {
            query.foreign_keys = foreignKeysSelection;
        } else if (selectedRFKs && Object.keys(selectedRFKs).length > 0) {
            const derived = Object.keys(selectedRFKs)
                .map((parentCol) => {
                    const fkMeta = Array.isArray(foreignKeys)
                        ? foreignKeys.find((f) => f.column_name === parentCol)
                        : Object.values(foreignKeys || {}).find(
                              (f) => f.column_name === parentCol,
                          );
                    const tableName = fkMeta?.referenced_table || null;
                    const fkCols = Array.isArray(selectedRFKs[parentCol])
                        ? selectedRFKs[parentCol]
                        : [];
                    return {
                        parentCol,
                        fkTables: tableName
                            ? [{ tableName, fkColumns: fkCols }]
                            : [],
                    };
                })
                .filter((item) => item.fkTables && item.fkTables.length > 0);
            if (derived.length > 0) query.foreign_keys = derived;
        }

        if (Array.isArray(selectedWhere) && selectedWhere.length > 0)
            query.where = selectedWhere;
        if (Object.keys(query).length === 0) query.columns = ["*"];

        let eggsport = {
            exportType,
            targetDatabase,
            targetTable,
            findReplaceRules: FRRules,
            limitOffsetRules,
            columnNameChanges,
        };

        let auto = {
            schedule: null,
            interval: null,
            unit: null,
            active: false,
        };

        const payload = {
            name: templateName,
            database: selectedDatabase,
            table: selectedTable,
            query,
            export: eggsport,
            user_id: user.id,
            auto: auto,
        };

        if (template.id) {
            fetch(`${appAddress}/api/query-templates/${template.id}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            })
                .then(async (response) => {
                    const data = await response.json();
                    if (!response.ok) {
                        const errorMsg = data?.message || "An error occurred";
                        setTemplateNameErr(true);
                        setTemplateNameErrMsg(errorMsg);
                        throw new Error(errorMsg);
                    }
                    setTemplateNameErr(false);
                    setTemplateNameErrMsg("");
                    closeEditModal();
                    navigate("/templates", {
                        replace: true,
                        state: { message: "Template updated successfully!" },
                    });
                })
                .catch((error) =>
                    console.error("Error updating template:", error),
                );
        } else {
            fetch(`${appAddress}/api/query-templates`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            })
                .then(async (response) => {
                    const data = await response.json();
                    if (!response.ok) {
                        const errorMsg = data?.message || "An error occurred";
                        setTemplateNameErr(true);
                        setTemplateNameErrMsg(errorMsg);
                        throw new Error(errorMsg);
                    }
                    setTemplateNameErr(false);
                    setTemplateNameErrMsg("");
                    navigate("/templates", {
                        state: { message: "Template saved successfully!" },
                    });
                })
                .catch((error) =>
                    console.error("Error saving template:", error),
                );
        }
    }

    // Fetch databases
    async function getDatabases() {
        try {
            const response = await fetch(
                `${appAddress}/api/databases/external`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                },
            );
            if (!response.ok) throw new Error(`Status ${response.status}`);
            const data = await response.json();
            setDatabases(Array.isArray(data) ? data : []);
        } catch (err) {
            setDatabases([]);
        }
    }

    // Fetch tables for a given external database name (used by targetDatabase)
    useEffect(() => {
        let cancelled = false;
        async function fetchDbTables() {
            if (!targetDatabase) {
                setDbTables([]);
                return;
            }
            try {
                toggleLoading(true);
                const r = await fetch(
                    `${appAddress}/api/databases/external/tables?name=${encodeURIComponent(targetDatabase)}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                        method: "GET",
                    },
                );
                if (!r.ok) throw new Error(`Status ${r.status}`);
                const d = await r.json();
                if (cancelled) return;
                setDbTables(
                    Array.isArray(d.tables)
                        ? d.tables
                        : Array.isArray(d)
                          ? d
                          : d.tables || [],
                );
            } catch (err) {
                if (!cancelled) setDbTables([]);
            } finally {
                if (!cancelled) toggleLoading(false);
            }
        }
        fetchDbTables();
        return () => {
            cancelled = true;
        };
    }, [targetDatabase, token, appAddress]);

    // Fetch tables when selectedDatabase changes
    useEffect(() => {
        let cancelled = false;
        async function fetchTablesForSelectedDb() {
            if (!selectedDatabase || !token) {
                setTables([]);
                return;
            }
            try {
                toggleLoading(true);
                const resource = await fetch(
                    `${appAddress}/api/databases/external/tables?name=${encodeURIComponent(selectedDatabase)}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: "application/json",
                        },
                    },
                );
                if (!resource.ok) throw new Error(`Status ${resource.status}`);
                const data = await resource.json();
                if (cancelled) return;
                if (
                    data &&
                    typeof data === "object" &&
                    Array.isArray(data.tables)
                )
                    setTables(data.tables);
                else if (Array.isArray(data)) setTables(data);
                else setTables(data?.tables ?? data?.rows ?? []);
            } catch (err) {
                if (!cancelled) setTables([]);
            } finally {
                if (!cancelled) toggleLoading(false);
            }
        }
        fetchTablesForSelectedDb();
        return () => {
            cancelled = true;
        };
    }, [selectedDatabase, token, appAddress]);

    // Fetch columns and foreign keys when selectedTable changes
    useEffect(() => {
        let cancelled = false;
        async function fetchTableColumns() {
            if (!selectedTable) return;
            try {
                if (!isHydratingTemplate.current) {
                    setSelectedCols([]);
                    setForeignKeysSelection([]);
                    setSelectedRFKs({});
                    setSelectedWhere([]);
                }

                toggleLoading(true);
                const res = await fetch(
                    `${appAddress}/api/databases/external/tables/${encodeURIComponent(selectedTable)}/columns?name=${encodeURIComponent(selectedDatabase)}`,
                    { headers: { Authorization: `Bearer ${token}` } },
                );
                if (!res.ok) throw new Error(`Status ${res.status}`);
                const data = await res.json();
                if (cancelled) return;
                setTableCols(data.columns || []);
                setForeignKeys(data.foreignKeys || []);
                // After fetching columns, fetch preview data
                await handleFetchTableData();
            } catch (err) {
                if (!cancelled) {
                    setTableCols([]);
                    setForeignKeys([]);
                }
            } finally {
                if (!cancelled) {
                    toggleLoading(false);
                    setUpdatedData(false);
                    isHydratingTemplate.current = false;
                }
            }
        }
        fetchTableColumns();
        return () => {
            cancelled = true;
        };
    }, [selectedTable, token, selectedDatabase, appAddress]);

    // Fetch preview/rows for the currently selected table
    async function handleFetchTableData() {
        if (!selectedTable) return;
        try {
            console.log("Fetching table data for", selectedTable);
            toggleLoading(true);
            const payload = {};
            if (selectedDatabase) payload.name = selectedDatabase;
            if (rowLimit && Number(rowLimit) > 0)
                payload.limit = Number(rowLimit);
            if (Array.isArray(selectedCols) && selectedCols.length > 0)
                payload.columns = selectedCols;
            if (
                Array.isArray(foreignKeysSelection) &&
                foreignKeysSelection.length > 0
            )
                payload.foreign_keys = foreignKeysSelection;
            if (Array.isArray(selectedWhere) && selectedWhere.length > 0)
                payload.where = selectedWhere;

            const resource = await fetch(
                `${appAddress}/api/databases/external/tables/${encodeURIComponent(selectedTable)}`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                },
            );
            if (!resource.ok) throw new Error(`Error ${resource.status}`);
            const data = await resource.json();
            setShowSuccessGlow(true);
            setTimeout(() => setShowSuccessGlow(false), 2000);
            const rows = Array.isArray(data)
                ? data
                : (data.rows ?? data.data ?? []);
            setTableData(rows);
        } catch (err) {
            console.error("Failed to fetch table data", err);
        } finally {
            toggleLoading(false);
            setUpdatedData(false);
        }
    }

    // Create new database connection
    async function handleCreateNewDatabase() {
        toggleLoading(true);
        const payload = {
            name: newDBName,
            description: newDBdescription,
            driver: newDBDriver,
            host: newDBHost,
            port: newDBPort,
            username: newDBUsername,
            password: newDBPassword,
        };
        try {
            const response = await fetch(
                `${appAddress}/api/databases/external`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(payload),
                },
            );
            if (!response.ok) {
                const errorData = await response.json();
                const errorMsg = errorData?.message || "An error occurred";
                throw new Error(errorMsg);
            }
            const data = await response.json();
            await getDatabases();
            setSelectedDatabase(data.name);
            setToggleNewDBModal(false);
            showMessage("Database created successfully!", true);
        } catch (error) {
            showMessage(`Error creating new database: ${error.message}`, false);
        } finally {
            toggleLoading(false);
        }
    }

    // Show message modal
    function showMessage(msg, success) {
        setMessage(msg);
        setMessageSuccess(success);
        setIsMessageModalOpen(true);
        setTimeout(() => {
            setIsMessageModalOpen(false);
        }, 3000);
    }

    // Toggle export type and reset column name changes
    const toggleExportType = () => {
        setExportType((prev) => !prev);
        setColumnNameChanges([]);
        if (exportType) {
            setColumnNameChanges((prev) => [
                ...prev,
                { original: "", new: "" },
            ]);
        }
    };

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

    // Functions for managing export rules
    const addFRRule = () =>
        setFRRules((prev) => [...prev, { find: "", replace: "" }]);
    const addLimitOffset = () =>
        setLimitOffsetRules((prev) => [...prev, { limit: 1000, offset: 0 }]);
    const handleFRRuleChange = (index, field, value) =>
        setFRRules((prev) =>
            prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
        );
    const handleLimitOffsetChange = (index, field, value) =>
        setLimitOffsetRules((prev) =>
            prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
        );
    const handleColumnNameChange = useCallback((index, field, value) => {
        setColumnNameChanges((prev) =>
            prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
        );
    }, []);
    const removeFRRule = (index) =>
        setFRRules((prev) => prev.filter((_, i) => i !== index));
    const removeLimitOffsetRule = (index) =>
        setLimitOffsetRules((prev) => prev.filter((_, i) => i !== index));
    const removeColumnChange = (index) =>
        setColumnNameChanges((prev) => prev.filter((_, i) => i !== index));

    const handleChange = (col) => {
        setSelectedCols((prev) =>
            prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
        );
    };

    const WHERE_OPERATORS = [
        "=",
        "!=",
        "<",
        "<=",
        ">",
        ">=",
        "LIKE",
        "NOT LIKE",
        "IN",
        "NOT IN",
        "IS NULL",
        "IS NOT NULL",
    ];

    // Handle changes to selected WHERE conditions
    const handleSelectedWhere = (e, idx) => {
        const val = e.target.value;
        setSelectedWhere((prev = []) => {
            const copy = [...prev];
            if (idx === copy.length) {
                if (!val) return copy;
                return [...copy, { column: val, operator: "=", value: "" }];
            }
            if (!val) {
                if (copy.length > 1) {
                    copy.splice(idx, 1);
                    return copy;
                }
                return [];
            }
            copy[idx] = {
                ...(copy[idx] || {}),
                column: val,
                operator: copy[idx]?.operator ?? "=",
                value: copy[idx]?.value ?? "",
            };
            return copy;
        });
    };

    // Handle changes to selected WHERE conditions
    const handleWhereOperatorChange = (idx, operator) => {
        setSelectedWhere((prev = []) => {
            const copy = [...prev];
            if (!copy[idx]) return copy;
            copy[idx] = { ...copy[idx], operator };
            if (operator === "IS NULL" || operator === "IS NOT NULL")
                copy[idx].value = "";
            return copy;
        });
    };

    // Handle changes to selected WHERE values
    const handleWhereValueChange = (idx, value) => {
        setSelectedWhere((prev = []) => {
            const copy = [...prev];
            if (!copy[idx]) return copy;
            copy[idx] = { ...copy[idx], value };
            return copy;
        });
    };

    // Handle foreign key selection
    function handleFKSelection(parentCol, tableName, fkColumn) {
        setSelectedRFKs((prev) => {
            const copy = { ...prev };
            const list = Array.isArray(copy[parentCol])
                ? [...copy[parentCol]]
                : [];
            const idx = list.indexOf(fkColumn);
            if (idx === -1) list.push(fkColumn);
            else list.splice(idx, 1);
            if (list.length) copy[parentCol] = list;
            else delete copy[parentCol];
            return copy;
        });

        // Update foreignKeysSelection state
        setForeignKeysSelection((prev) => {
            const copy = prev.map((p) => ({
                parentCol: p.parentCol,
                fkTables: p.fkTables.map((t) => ({
                    tableName: t.tableName,
                    fkColumns: [...t.fkColumns],
                })),
            }));
            const parentIdx = copy.findIndex((p) => p.parentCol === parentCol);
            if (parentIdx === -1) {
                return [
                    ...copy,
                    {
                        parentCol,
                        fkTables: [{ tableName, fkColumns: [fkColumn] }],
                    },
                ];
            }
            const parent = copy[parentIdx];
            const tableIdx = parent.fkTables.findIndex(
                (t) => t.tableName === tableName,
            );
            if (tableIdx === -1)
                parent.fkTables.push({ tableName, fkColumns: [fkColumn] });
            else {
                const table = parent.fkTables[tableIdx];
                const colIdx = table.fkColumns.indexOf(fkColumn);
                if (colIdx === -1) table.fkColumns.push(fkColumn);
                else {
                    table.fkColumns.splice(colIdx, 1);
                    if (table.fkColumns.length === 0)
                        parent.fkTables.splice(tableIdx, 1);
                }
            }
            if (parent.fkTables.length === 0) copy.splice(parentIdx, 1);
            return copy;
        });
    }

    // Reset all query rules and selections
    function resetRules() {
        setSelectedCols([]);
        setSelectedWhere([]);
        setForeignKeysSelection([]);
        setSelectedRFKs([]);
        setRowLimit("");
        setUpdatedData(false);
    }

    // literally just toggles the side menu open/closed, why is this not part of the other menu toggles?
    function handleMenuToggle() {
        setIsMenuOpen(!isMenuOpen);
    }

    // Toggle specific menus, closing others
    function toggleMenus(menuName) {
        setMenus((prevState) => {
            const newState = {};
            Object.keys(prevState).forEach((key) => {
                newState[key] = false;
            });
            newState[menuName] = !prevState[menuName];
            return newState;
        });
    }

    // Handle selection of new database
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

    // Expose all state and logic needed by TemplateSideMenu
    return {
        handleFetchTableData,
        loading,
        templateNameErr,
        setTemplateNameErr,
        templateNameErrMsg,
        setTemplateNameErrMsg,
        message,
        setMessage,
        messageSuccess,
        setMessageSuccess,
        isMessageModalOpen,
        setIsMessageModalOpen,
        showWarning,
        setShowWarning,
        showSuccessGlow,
        setShowSuccessGlow,
        showColumnWindow,
        setShowColumnWindow,
        columnNameChanges,
        setColumnNameChanges,
        FRRules,
        setFRRules,
        limitOffsetRules,
        setLimitOffsetRules,
        tables,
        setTables,
        databases,
        setDatabases,
        newDBName,
        setNewDBName,
        newDBdescription,
        setNewDBdescription,
        newDBDriver,
        setNewDBDriver,
        newDBHost,
        setNewDBHost,
        newDBPort,
        setNewDBPort,
        newDBUsername,
        setNewDBUsername,
        newDBPassword,
        setNewDBPassword,
        selectedDatabase,
        setSelectedDatabase,
        selectedTable,
        setSelectedTable,
        rowLimit,
        setRowLimit,
        selectedCols,
        setSelectedCols,
        selectedWhere,
        setSelectedWhere,
        foreignKeysSelection,
        setForeignKeysSelection,
        templateName,
        setTemplateName,
        exportType,
        setExportType,
        toggles,
        setToggles,
        selectedRFKs,
        setSelectedRFKs,
        toggleNewDBModal,
        setToggleNewDBModal,
        isMenuOpen,
        setIsMenuOpen,
        menus,
        setMenus,
        selectedColsCount,
        selectedRFKsCount,
        tableData,
        setTableData,
        tableCols,
        setTableCols,
        foreignKeys,
        setForeignKeys,
        targetDatabase,
        setTargetDatabase,
        targetTable,
        setTargetTable,
        dbTables,
        setDbTables,
        updatedData,
        setUpdatedData,
        getDatabases,
        handleCreateNewDatabase,
        showMessage,
        toggleExportType,
        isToggled,
        addFRRule,
        addLimitOffset,
        handleFRRuleChange,
        handleLimitOffsetChange,
        handleColumnNameChange,
        removeFRRule,
        removeLimitOffsetRule,
        removeColumnChange,
        handleChange,
        WHERE_OPERATORS,
        handleSelectedWhere,
        handleWhereOperatorChange,
        handleWhereValueChange,
        handleFKSelection,
        resetRules,
        handleMenuToggle,
        toggleMenus,
        handleNewDatabase,
        handleSaveTemplate,
        toggleUI,
        editTableData,
    };
}
