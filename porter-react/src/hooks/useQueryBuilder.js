import { useState, useEffect, useCallback, useRef } from "react";

// this place is a mess but
// it has all the state and logic for the TQB component
// i tried to organize it as best as possible into sections with comments
// but it could still use some refactoring and cleanup

// pretty sure like a 5th of this code is unused or duped, but I'm literally too lazy to go back and forth and clean it up right now
// but hey, it works 
export function useQueryBuilder({
    appAddress,
    token,
    user,
    navigate,
    template = {},
    closeEditModal = () => {},
}) {
    // UI
    const [loading, toggleLoading] = useState(false); // Global loading state
    const [showWarning, setShowWarning] = useState(false); // Show warning modal (to tell user to refresh table data)
    const [showSuccessGlow, setShowSuccessGlow] = useState(false); // Show success glow on data fetch
    const [showColumnWindow, setShowColumnWindow] = useState(false); // Show column name changes window
    const [isMenuOpen, setIsMenuOpen] = useState(false); // Side menu open/close
    const [menus, setMenus] = useState({}); // Individual menu toggles (can't this be used for isMenuOpen and showcolumnWindow too? I'm too scared to address it right now)
    const [toggleNewDBModal, setToggleNewDBModal] = useState(false); // New DB modal
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false); // Message modal
    const [toggles, setToggles] = useState({}); // Generic toggles for various UI elements

    // Selected Foreign Keys, used for managing FK selections AND showing the correct checkboxes (making the old UI column obsolete)
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

    const isHydratingTemplate = useRef(false); // To prevent overwriting user changes when template prop changes

    // Message, used for showing success/error messages to the user
    const [message, setMessage] = useState("");
    const [messageSuccess, setMessageSuccess] = useState(false);

    // Database Connection
    const [databases, setDatabases] = useState([]); // Available external databases

    // New Database Connection fields
    const [newDBName, setNewDBName] = useState(""); 
    const [newDBdescription, setNewDBdescription] = useState(""); 
    const [newDBDriver, setNewDBDriver] = useState("mysql");
    const [newDBHost, setNewDBHost] = useState("localhost");
    const [newDBPort, setNewDBPort] = useState("3306");
    const [newDBUsername, setNewDBUsername] = useState("");
    const [newDBPassword, setNewDBPassword] = useState("");

    // Query Builder
    const [tables, setTables] = useState([]); // Tables in selected database
    const [selectedDatabase, setSelectedDatabase] = useState(
        template.database || "",
    );
    const [selectedTable, setSelectedTable] = useState(template.table || ""); // Selected table in selected database
    
    const [rowLimit, setRowLimit] = useState(""); // Row limit for data preview
    const [selectedCols, setSelectedCols] = useState(template.query?.columns || []); // Selected columns for query
    const [selectedWhere, setSelectedWhere] = useState(template.query?.where || []); // Selected where conditions for query
    const [foreignKeysSelection, setForeignKeysSelection] = useState(template.query?.foreign_keys || []); // Selected foreign keys for query

    // Table Data Preview
    const [tableData, setTableData] = useState([]); // Preview data for selected table
    const [editTableData, setEditTableData] = useState([]); // I think this is obsolete now
    const [tableCols, setTableCols] = useState([]); // Columns in selected table
    const [foreignKeys, setForeignKeys] = useState([]); // Foreign keys in selected table
    const [updatedData, setUpdatedData] = useState(false); // Flag to indicate if data has been updated and needs refetching

    // Query builder rules and template info

    // Template Info
    const [templateName, setTemplateName] = useState(template.name || ""); // Template name
    const [templateNameErr, setTemplateNameErr] = useState(false); // Template name error flag, should just make it check if the msg is empty instead
    const [templateNameErrMsg, setTemplateNameErrMsg] = useState(""); // Template name error message (actually is used by other things too but whatever)
    
    // Export Rules
    const [exportType, setExportType] = useState(template.export?.exportType || false); // false = CSV, true = SQL
    const [columnNameChanges, setColumnNameChanges] = useState(template.export?.columnNameChanges || []); // Column name changes 
    const [FRRules, setFRRules] = useState(template.export?.findReplaceRules || []); // Find-replace rules 
    const [limitOffsetRules, setLimitOffsetRules] = useState(template.export?.limitOffsetRules || []); // Limit-offset rules 
    const [findOptions, setFindOptions] = useState({}); // Find options for find-replace rules
    const [findOptionsLoading, setFindOptionsLoading] = useState(false); // Loading state for populating find options

    // Export Target
    const [targetDatabase, setTargetDatabase] = useState(template.export?.targetDatabase || ""); // Target database for export
    const [targetTable, setTargetTable] = useState(template.export?.targetTable || ""); // Target table for export
    const [dbTables, setDbTables] = useState([]); // Tables in target database

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
        setTargetDatabase(template.export?.targetDatabase || "");
        setTargetTable(template.export?.targetTable || "");
        setColumnNameChanges(
            Array.isArray(template.export?.columnNameChanges)
                ? template.export.columnNameChanges
                : [],
        );
        setShowColumnWindow(
            Array.isArray(template.export?.columnNameChanges) &&
                template.export.columnNameChanges.length > 0,
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

    // BASIC FUNCTIONS

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

    // TEMPLATE FUNCTIONS \\

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

        // Construct export object

        // export values
        let eggsport = { // don't ask
            exportType,
            targetDatabase,
            targetTable,
            findReplaceRules: FRRules,
            limitOffsetRules,
            columnNameChanges,
        };

        // auto values made null to not break things, is set by user in templates later
        let auto = {
            schedule: null,
            interval: null,
            unit: null,
            active: false,
        };

        // Construct payload
        const payload = {
            name: templateName,
            database: selectedDatabase,
            table: selectedTable,
            query,
            export: eggsport, //again, don't ask
            user_id: user.id,
            auto: auto,
        };

        if (template.id) { // wow i wonder if the newly created template has an id yet
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

    // Fetch tables for a given external database name (used by targetDatabase)
    useEffect(() => { // does it have to be useEffect? could it be a function called when targetDatabase changes? i dont car
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
    useEffect(() => { // again, not sure if useEffect is necessary here
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
    useEffect(() => { // again with the useEffect
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
    // amazing, it's not a useEffect!
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

    // Populate find options for find-replace rules (fetches all rows, groups unique values by column)
    const populateFindOptions = async () => {
        if (!selectedTable || !selectedDatabase) return {};
        console.log("Populating find options for", selectedTable);
        setFindOptionsLoading(true);
        try {
            const payload = {};
            if (selectedDatabase) payload.name = selectedDatabase;
            // No limit to get ALL rows
            if (Array.isArray(selectedCols) && selectedCols.length > 0)
                payload.columns = selectedCols;
            // Backend typically enforces a default row limit; request a larger sample for option population.
            // (Still capped to avoid huge payloads.)
            payload.limit = 10000;
            if (
                Array.isArray(foreignKeysSelection) &&
                foreignKeysSelection.length > 0
            )
                payload.foreign_keys = foreignKeysSelection;
            if (Array.isArray(selectedWhere) && selectedWhere.length > 0)
                payload.where = selectedWhere;

            const response = await fetch(
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
            if (!response.ok) throw new Error(`Error ${response.status}`);
            const json = await response.json();
            const rows = Array.isArray(json)
                ? json
                : (json?.rows ?? json?.data ?? []);

            // Group unique raw values by column (FRRuleField expects arrays of primitive values)
            // Use keys present in returned rows so this works for "All columns" and FK-projected columns.
            const groupedSets = {};
            (Array.isArray(rows) ? rows : []).forEach((row) => {
                if (!row || typeof row !== "object") return;
                Object.entries(row).forEach(([key, val]) => {
                    if (!groupedSets[key]) groupedSets[key] = new Set();
                    groupedSets[key].add(val);
                });
            });

            const options = {};
            Object.keys(groupedSets).forEach((key) => {
                options[key] = Array.from(groupedSets[key]);
            });
            setFindOptions(options);
            return options;
        } catch (err) {
            console.error("Failed to populate find options", err);
            setFindOptions({});
            return {};
        } finally {
            setFindOptionsLoading(false);
        }
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

    // DATABASE FUNCTIONS \\

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
    
    // UI FUNCTIONS \\

    // Handle column selection changes
    const handleChange = (col) => {
        setSelectedCols((prev) =>
            prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
        );
    };

    // Show message modal
    function showMessage(msg, success) {
        setMessage(msg);
        setMessageSuccess(success);
        setIsMessageModalOpen(true);
        setTimeout(() => {
            setIsMessageModalOpen(false);
        }, 3000); // Auto-close after 3 seconds
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

    //  ALL HAIL THE VARIABLE MONOLITH \\
    // expose all state and functions needed by the QueryBuilder component
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
        findOptions,
        setFindOptions,
        findOptionsLoading,
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
        populateFindOptions,
        toggleLoading,
        template,
    };
}
