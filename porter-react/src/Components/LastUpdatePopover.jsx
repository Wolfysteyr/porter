import { AppContext } from "../Context/AppContext";
import { React, useEffect, useState, useContext } from "react";
import Popover from "@mui/material/Popover";
import ListAltRoundedIcon from "@mui/icons-material/ListAltRounded";

export default function LastUpdatePopover({ template }) {
    // get app context values
    const { appAddress, token } = useContext(AppContext);

    // Popover state
    const [anchorEl1, setAnchorEl1] = useState(null);
    const open1 = Boolean(anchorEl1);
    const id1 = open1 ? "last-update-popover" : undefined;

    const [anchorEl2, setAnchorEl2] = useState(null);
    const [selectedEntry, setSelectedEntry] = useState(null);
    const open2 = Boolean(anchorEl2);
    const id2 = open2 ? "last-update-popover-2" : undefined;

    // Handlers to open/close popover
    const handleClick1 = (event) => {
        setAnchorEl1(event.currentTarget);
    };
    const handleClose1 = () => {
        setAnchorEl1(null);
    };

    const handleClick2 = (event, entry) => {
        setAnchorEl2(event.currentTarget);
        setSelectedEntry(entry);
    };
    const handleClose2 = () => {
        setAnchorEl2(null);
        setSelectedEntry(null);
    };

    const lastUpdate = template.updated_at;

    // template history data state
    const [history, setHistory] = useState([]); // contains the entire history for this template

    // users data state
    const [users, setUsers] = useState([]);

    // fetch template history data
    async function fetchTemplateHistory() {
        try {
            const response = await fetch(
                `${appAddress}/api/templates/${encodeURIComponent(template.id)}/history`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    credentials: "include",
                },
            );
            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (error) {
            console.error("Error fetching template history:", error);
        }
    }

    async function fetchUsers() {
        try {
            const response = await fetch(`${appAddress}/api/users`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                credentials: "include",
            });
            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    }

    // set history data and users
    useEffect(() => {
        let isMounted = true;

        async function loadData() {
            const [historyData, usersData] = await Promise.all([
                fetchTemplateHistory(),
                fetchUsers(),
            ]);

            if (!isMounted) return;

            setHistory(Array.isArray(historyData) ? historyData : []);
            setUsers(Array.isArray(usersData) ? usersData : []);
        }

        loadData();
        return () => {
            isMounted = false;
        };
    }, [appAddress, token, template?.id]);

    // handle getting changes for each history entry
    // compares the current (selected) template with the previous version of the template to determine what was changed
    // like git diff but for templates
    function historyDiff(historyId) {

        // If history hasn't loaded yet, avoid throwing during render.
        if (!Array.isArray(history) || history.length === 0) return {};

        // TYPES TO LOOK FOR \\

        // non-array changes, simple
        let name_change;
        let db_change; // shouldnt even be possible at the moment but just in case
        let table_change;

        // array changes, more complex
        // has to go through each array basically twice, checking both ways to see what was added and what was removed
        let query_added = {
            columns: [],
            where: [],
            foreign_keys: [],
        }; // columns, where, fks
        let query_removed = {
            columns: [],
            where: [],
            foreign_keys: [],
        };
        let export_added = {
            exportType: [],
            targetTable: [],
            targetDatabase: [],
            findReplaceRules: [],
            limitOffsetRules: [],
            columnNameChanges: [],
        }; // type, target db, target table/file, f&r, column name changes, limit/offset changes
        let export_removed = {
            exportType: [],
            targetTable: [],
            targetDatabase: [],
            findReplaceRules: [],
            limitOffsetRules: [],
            columnNameChanges: [],
        };
        let export_changes = {
            exportType: [],
            targetTable: [],
            targetDatabase: [],
        };
        let auto_changes = {
            schedule: [],
            interval: [],
            unit: [],
            active: [],
        }; // schedule, interval, unit, active | same as export for all of these

        // find the current version of the template in the history using the historyId
        const nHistoryIndex = history.findIndex(
            (entry) => String(entry.id) === String(historyId),
        );
        if (nHistoryIndex < 0) return {};

        // histories are sorted DESC by date; the previous version is the next item.
        const nEntry = history[nHistoryIndex];
        const prevEntry = history[nHistoryIndex + 1] ?? null;

        let nHistory = nEntry?.template_snapshot ?? null;
        let prevHistory = prevEntry?.template_snapshot ?? null;

        if (!nHistory) return {};


        if (!prevHistory) {
            // if there is no previous history, then this is the first version of the template, so we can just return all the values as added
            name_change = `null => ${nHistory.template_name}`;
            db_change = `null => ${nHistory.template_db}`;
            table_change = `null => ${nHistory.template_table}`;
            query_added.columns = Array.isArray(nHistory?.template_query?.columns)
                ? nHistory.template_query.columns
                : [];
            query_added.where = Array.isArray(nHistory?.template_query?.where)
                ? nHistory.template_query.where.map(
                      (clause) =>
                          `${clause.column} ${clause.operator} ${clause.value}`,
                  )
                : [];
            query_added.foreign_keys = flattenForeignKeys(
                nHistory?.template_query?.foreign_keys,
            );

            export_added.exportType.push(nHistory?.export_settings?.exportType);
            export_added.targetTable.push(nHistory?.export_settings?.targetTable);
            export_added.targetDatabase.push(
                nHistory?.export_settings?.targetDatabase,
            );
            export_added.findReplaceRules.push(
                Array.isArray(nHistory?.export_settings?.findReplaceRules)
                    ? nHistory.export_settings.findReplaceRules.map(
                          (rule) => `${rule.find} -> ${rule.replace}`,
                      )
                    : [],
            );
            export_added.limitOffsetRules.push(
                Array.isArray(nHistory?.export_settings?.limitOffsetRules)
                    ? nHistory.export_settings.limitOffsetRules.map(
                          (rule) => ({ limit: rule.limit, offset: rule.offset }),
                      )
                    : [],
            );
            export_added.columnNameChanges.push(
                Array.isArray(nHistory?.export_settings?.columnNameChanges)
                    ? nHistory.export_settings.columnNameChanges.map(
                          (change) => `${change.original} -> ${change.new}`,
                      )
                    : [],
            );

            auto_changes.schedule.push(nHistory?.automation_settings?.schedule);
            auto_changes.interval.push(nHistory?.automation_settings?.interval);
            auto_changes.unit.push(nHistory?.automation_settings?.unit);
            auto_changes.active.push(nHistory?.automation_settings?.active);
            // return all values as added
            let diffReturn = {
                name_change,
                db_change,
                table_change,
                query_added,
                query_removed,
                export_changes,
                export_added,
                export_removed,
                auto_changes,
            };
            return diffReturn;
        }
        name_change = checkForChangeSimple(
            prevHistory.template_name,
            nHistory.template_name,
        );
        db_change = checkForChangeSimple(
            prevHistory.template_db,
            nHistory.template_db,
        );
        table_change = checkForChangeSimple(
            prevHistory.template_table,
            nHistory.template_table,
        );

        // column changes, quite simple as its just an array of column names, no other options or values to worry about
        let col_diff = checkForChangeArray(
            prevHistory?.template_query?.columns,
            nHistory?.template_query?.columns,
        );
        query_added = { ...query_added, columns: col_diff.added };
        query_removed = { ...query_removed, columns: col_diff.removed };

        // where changes. decided to just turn the entire clause into a string here
        // then split it back into individual values for the sake of database's correctness
        let nHistory_where_clauses = Array.isArray(nHistory?.template_query?.where)
            ? nHistory.template_query.where.map(
                  (clause) =>
                      `${clause.column} ${clause.operator} ${clause.value ? clause.value : ''}`,
              )
            : [];
        let prevHistory_where_clauses = Array.isArray(
            prevHistory?.template_query?.where,
        )
            ? prevHistory.template_query.where.map(
                  (clause) =>
                      `${clause.column} ${clause.operator} ${clause.value ? clause.value : ''}`,
              )
            : [];

        let where_diff = checkForChangeArray(
            prevHistory_where_clauses,
            nHistory_where_clauses,
        );
        query_added = { ...query_added, where: where_diff.added };
        query_removed = { ...query_removed, where: where_diff.removed };

        // FOREIGN KEYS CHANGES \\
        // flatten into parent/table/column tokens so FK columns can be shown under their parent column
        const nFks = Array.isArray(nHistory?.template_query?.foreign_keys)
            ? nHistory.template_query.foreign_keys
            : [];
        const prevFks = Array.isArray(prevHistory?.template_query?.foreign_keys)
            ? prevHistory.template_query.foreign_keys
            : [];

        const nFkFlat = flattenForeignKeys(nFks);
        const prevFkFlat = flattenForeignKeys(prevFks);

        const fk_diff = checkForChangeArray(
            prevFkFlat.map((fk) => toForeignKeyToken(fk)),
            nFkFlat.map((fk) => toForeignKeyToken(fk)),
        );
        query_added = {
            ...query_added,
            foreign_keys: fk_diff.added
                .map((token) => fromForeignKeyToken(token))
                .filter(Boolean),
        };
        query_removed = {
            ...query_removed,
            foreign_keys: fk_diff.removed
                .map((token) => fromForeignKeyToken(token))
                .filter(Boolean),
        };

        // EXPORT CHANGES \\
        // "export_settings": {
        //      "exportType": true/false, "targetTable": "", "targetDatabase": "",
        //      "findReplaceRules": [{"find": "", "replace": ""}], "limitOffsetRules": [{"limit": int, "offset": int}],
        //      "columnNameChanges": [{"new": "", "original": ""}]}
        export_changes.exportType.push(
            checkForChangeSimple(
                prevHistory.export_settings.exportType,
                nHistory.export_settings.exportType,
            ),
        );
        export_changes.targetTable.push(
            checkForChangeSimple(
                prevHistory.export_settings.targetTable,
                nHistory.export_settings.targetTable,
            ),
        );
        export_changes.targetDatabase.push(
            checkForChangeSimple(
                prevHistory.export_settings.targetDatabase,
                nHistory.export_settings.targetDatabase,
            ),
        );

        let frCol_diff = checkForChangeArray(
            Array.isArray(prevHistory?.export_settings?.findReplaceRules)
                ? prevHistory.export_settings.findReplaceRules.map(
                      (rule) => `${rule.find} -> ${rule.replace}`,
                  )
                : [],
            Array.isArray(nHistory?.export_settings?.findReplaceRules)
                ? nHistory.export_settings.findReplaceRules.map(
                      (rule) => `${rule.find} -> ${rule.replace}`,
                  )
                : [],
        );
        export_added.findReplaceRules.push(frCol_diff.added);
        export_removed.findReplaceRules.push(frCol_diff.removed);
        let loCol_diff = checkForChangeArray(
            Array.isArray(prevHistory?.export_settings?.limitOffsetRules)
                ? prevHistory.export_settings.limitOffsetRules.map(
                      (rule) => `limit ${rule.limit} offset ${rule.offset}`,
                  )
                : [],
            Array.isArray(nHistory?.export_settings?.limitOffsetRules)
                ? nHistory.export_settings.limitOffsetRules.map(
                      (rule) => `limit ${rule.limit} offset ${rule.offset}`,
                  )
                : [],
        );
        export_added.limitOffsetRules.push(loCol_diff.added);
        export_removed.limitOffsetRules.push(loCol_diff.removed);
        let colNameChange_diff = checkForChangeArray(
            Array.isArray(prevHistory?.export_settings?.columnNameChanges)
                ? prevHistory.export_settings.columnNameChanges.map(
                      (change) => `${change.original} -> ${change.new}`,
                  )
                : [],
            Array.isArray(nHistory?.export_settings?.columnNameChanges)
                ? nHistory.export_settings.columnNameChanges.map(
                      (change) => `${change.original} -> ${change.new}`,
                  )
                : [],
        );
        export_added.columnNameChanges.push(colNameChange_diff.added);
        export_removed.columnNameChanges.push(colNameChange_diff.removed);

        // AUTOMATION CHANGES \\
        // "automation_settings": {"schedule": every/hourly/daily/weekly etc, "interval": int, "unit": minutes, hours, days etc, "active": true/false}
        auto_changes.schedule.push(
            checkForChangeSimple(
                prevHistory?.automation_settings?.schedule,
                nHistory?.automation_settings?.schedule,
            ),
        );
        auto_changes.interval.push(
            checkForChangeSimple(
                prevHistory?.automation_settings?.interval,
                nHistory?.automation_settings?.interval,
            ),
        );
        auto_changes.unit.push(
            checkForChangeSimple(
                prevHistory?.automation_settings?.unit,
                nHistory?.automation_settings?.unit,
            ),
        );
        auto_changes.active.push(
            checkForChangeSimple(
                prevHistory?.automation_settings?.active,
                nHistory?.automation_settings?.active,
            ),
        );

        // compile all changes into one object to return
        let diffReturn = {
            name_change,
            db_change,
            table_change,
            query_added,
            query_removed,
            export_changes,
            export_added,
            export_removed,
            auto_changes,
        };

        return diffReturn;
    }

    // HELPER FUNCTIONS FOR HISTORY DIFF \\

    // checks for simple value changes like name, db, table
    function checkForChangeSimple(a, b) {
        if (a !== b) {
            return `${a} => ${b}`; // return the change in the format "old => new"
        }
        return null; // return null if there is no change
    }

    // checks for array changes like queries, exports, automations
    // if the array has sub-arrays, just go to the lowest level possible and call the function there.
    function checkForChangeArray(a, b) {
        const arrA = Array.isArray(a) ? a : [];
        const arrB = Array.isArray(b) ? b : [];

        let diff = { added: [], removed: [] };

        arrA.forEach((item) => {
            if (!arrB.includes(item)) diff.removed.push(item);
        });
        arrB.forEach((item) => {
            if (!arrA.includes(item)) diff.added.push(item);
        });

        return diff;
    }

    function flattenForeignKeys(foreignKeys) {
        const list = Array.isArray(foreignKeys) ? foreignKeys : [];

        const flattened = list.flatMap((fk) => {
            let fkObj = fk;
            if (typeof fkObj === "string") {
                try {
                    fkObj = JSON.parse(fkObj);
                } catch {
                    return [];
                }
            }

            const parentCol =
                fkObj?.parentCol ??
                fkObj?.parent_column ??
                fkObj?.parent ??
                fkObj?.column;
            if (!parentCol) return [];

            const tables = Array.isArray(fkObj?.fkTables)
                ? fkObj.fkTables
                : Array.isArray(fkObj?.referencedTables)
                  ? fkObj.referencedTables
                  : Array.isArray(fkObj?.tables)
                    ? fkObj.tables
                    : [];

            return tables.flatMap((table) => {
                const tableName =
                    table?.tableName ??
                    table?.table ??
                    table?.name ??
                    table?.referencedTable ??
                    "";
                const fkColumns = Array.isArray(table?.fkColumns)
                    ? table.fkColumns
                    : Array.isArray(table?.columns)
                      ? table.columns
                      : Array.isArray(table?.referencedColumns)
                        ? table.referencedColumns
                        : [];

                return fkColumns
                    .filter(
                        (fkColumn) =>
                            fkColumn !== null &&
                            fkColumn !== undefined &&
                            String(fkColumn).trim() !== "",
                    )
                    .map((fkColumn) => ({
                        parentCol,
                        tableName,
                        fkColumn,
                    }));
            });
        });

        const deduped = Array.from(
            new Map(
                flattened.map((fkEntry) => [toForeignKeyToken(fkEntry), fkEntry]),
            ).values(),
        );

        return deduped.sort((a, b) =>
            toForeignKeyToken(a).localeCompare(toForeignKeyToken(b)),
        );
    }

    function toForeignKeyToken(fk) {
        return JSON.stringify([
            fk?.parentCol ?? "",
            fk?.tableName ?? "",
            fk?.fkColumn ?? "",
        ]);
    }

    function fromForeignKeyToken(token) {
        try {
            const parsed = JSON.parse(token);
            if (!Array.isArray(parsed) || parsed.length < 3) return null;
            return {
                parentCol: parsed[0],
                tableName: parsed[1],
                fkColumn: parsed[2],
            };
        } catch {
            return null;
        }
    }

    function groupForeignKeysByParent(foreignKeys) {
        const entries = Array.isArray(foreignKeys) ? foreignKeys : [];

        const grouped = entries.reduce((acc, fk) => {
            if (!fk?.parentCol || !fk?.fkColumn) return acc;
            const label = fk.tableName
                ? `${fk.tableName}.${fk.fkColumn}`
                : `${fk.fkColumn}`;
            if (!acc[fk.parentCol]) acc[fk.parentCol] = new Set();
            acc[fk.parentCol].add(label);
            return acc;
        }, {});

        return Object.fromEntries(
            Object.entries(grouped).map(([parentCol, labelSet]) => [
                parentCol,
                Array.from(labelSet).sort((a, b) => a.localeCompare(b)),
            ]),
        );
    }


    const diff = selectedEntry ? historyDiff(selectedEntry.id) : null;
    const addedFkByParent = groupForeignKeysByParent(
        diff?.query_added?.foreign_keys,
    );
    const removedFkByParent = groupForeignKeysByParent(
        diff?.query_removed?.foreign_keys,
    );
    const hasDirectColumnChanges =
        (diff?.query_added?.columns?.length ?? 0) > 0 ||
        (diff?.query_removed?.columns?.length ?? 0) > 0;
    const hasFkChanges =
        Object.keys(addedFkByParent).length > 0 ||
        Object.keys(removedFkByParent).length > 0;
    const hasColumnChanges = hasDirectColumnChanges || hasFkChanges;

    const addedColumnsSet = new Set(diff?.query_added?.columns || []);
    const removedColumnsSet = new Set(diff?.query_removed?.columns || []);
    const fkParentSet = new Set([
        ...Object.keys(addedFkByParent),
        ...Object.keys(removedFkByParent),
    ]);
    const allColumnParents = Array.from(
        new Set([
            ...(diff?.query_added?.columns || []),
            ...(diff?.query_removed?.columns || []),
            ...Array.from(fkParentSet),
        ]),
    );

    function getParentStyle(parent) {
        const isAdded = addedColumnsSet.has(parent);
        const isRemoved = removedColumnsSet.has(parent);
        const hasAddedFks = (addedFkByParent[parent] || []).length > 0;
        const hasRemovedFks = (removedFkByParent[parent] || []).length > 0;

        if (isAdded) {
            return {
                prefix: "+",
                label: parent,
                style: {
                    marginBottom: "0.0rem",
                    borderRadius: "8px",
                    border: "transparent",
                    color: "#000000",
                    backgroundColor: "#46cc51",
                    padding: "0.5rem",
                },
            };
        }

        if (isRemoved) {
            return {
                prefix: "-",
                label: parent,
                style: {
                    marginBottom: "0.0rem",
                    borderRadius: "8px",
                    border: "transparent",
                    color: "#000000",
                    backgroundColor: "#ff4c4c",
                    padding: "0.5rem",
                },
            };
        }

        let borderColor = "#2f7d37";
        let bgColor = "#d8f5dc";

        if (hasAddedFks && hasRemovedFks) {
            borderColor = "#1f5f9e";
            bgColor = "#46c8fc";
        } else if (hasRemovedFks) {
            borderColor = "#9b2f2f";
            bgColor = "#ffdede";
        }

        return {
            prefix: null,
            label: `FK Parent: ${parent}`,
            style: {
                marginBottom: "0.0rem",
                borderRadius: "8px",
                border: `1px dotted ${borderColor}`,
                color: "#000000",
                backgroundColor: bgColor,
                padding: "0.5rem",
            },
        };
    }

    return (
        <div>
            <span
                id={id1}
                style={{
                    textDecoration: "dotted underline",
                    cursor: "help",
                    textDecorationThickness: "2px",
                }}
                onClick={handleClick1}
            >
                {lastUpdate
                    ? `${new Date(lastUpdate).toLocaleDateString()}`
                    : "No updates yet"}

                <ListAltRoundedIcon
                    style={{
                        paddingLeft: "5px",
                        verticalAlign: "middle",
                        fontSize: "18px",
                    }}
                />
            </span>
            <Popover
                id={id1}
                open={open1}
                anchorEl={anchorEl1}
                onClose={handleClose1}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "center",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "center",
                }}
               
            >
                <div style={{ padding: "1rem", maxWidth: "300px" }}>
                    <h3 style={{ marginTop: 0 }}>Update History</h3>
                    {history.length === 0 ? (
                        <p>No update history available.</p>
                    ) : (
                        <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
                            {history.map((entry) => (
                                <li
                                    key={entry.id ?? entry.updated_at}
                                    style={{ marginBottom: "0.5rem" }}
                                >
                                    <strong
                                        className="popover-history"
                                        onClick={(e) => handleClick2(e, entry)}
                                    >
                                        {new Date(
                                            entry.updated_at,
                                        ).toLocaleString()}
                                    </strong>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Popover>
            {/* Single details Popover for the selected history entry */}
            <Popover
                id={id2}
                open={open2}
                anchorEl={anchorEl2}
                onClose={handleClose2}
                anchorOrigin={{
                    vertical: "center",
                    horizontal: "right",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "left",
                }}
            >
                <div
                    style={{
                        padding: "1rem",
                        maxWidth: "300px",
                        backgroundColor: "#c5c5c5",
                    }}
                >
                    {selectedEntry ? (
                        <>
                            <p>
                                Committed by{' '}
                                <span style={{ fontWeight: 'bold' }}>
                                    {users.find((user) => user.id === selectedEntry.committed_by)?.name || 'Unknown'}
                                </span>
                            </p>
                            <hr style={{ border: '1px solid #000' }} />
                            <p>
                                <strong>Changes:</strong>
                            </p>
                            <div style={{ paddingLeft: '1.2rem', margin: 0 }} className="popover-changes">
                                {/* Object structure for reference 
                                    {
                                        name_change: "old => new",
                                        db_change: "old => new",
                                        table_change: "old => new",
                                        query_added: {columns: [], where: [{column, operator, value}], foreign_keys: [{fkTables: [cols], referencedTables: [tables]}], parentCol},
                                        query_removed: {columns: [], where: [{column, operator, value}], foreign_keys: [{fkTables: [cols], referencedTables: [tables]}], parentCol},
                                        export_changes: {exportType: "true/false => false/true", targetTable: "old => new", targetDatabase: "old => new"},
                                        export_added: {findReplaceRules: [oldFind => newFind, oldReplace => newReplace], limitOffsetRules: [oldLimit => newLimit, oldOffset => newOffset], columnNameChanges: [oldName => newName]},
                                        export_removed: {findReplaceRules: [oldFind => newFind, oldReplace => newReplace], limitOffsetRules: [oldLimit => newLimit, oldOffset => newOffset], columnNameChanges: [oldName => newName]},
                                        auto_changes: {schedule: [oldSchedule => newSchedule], interval: [oldInterval => newInterval], unit: [oldUnit => newUnit], active: [oldActive => newActive]}
                                    }
                                */}
                                {/* Name change */}
                                {diff?.name_change && (
                                    <p style={{ marginBottom: '0.1rem', borderRadius: '8px', border: 'transparent', color: '#000000', backgroundColor: '#00b7ff', padding: '0.5rem' }}>
                                        <em>Name:</em>{' '}
                                        {diff.name_change}
                                    </p>
                                )}

                                {/* DB change */}
                                {diff?.db_change && (
                                    <p style={{ marginBottom: '0.1rem', borderRadius: '8px', border: 'transparent', color: '#000000', backgroundColor: '#00b7ff', padding: '0.5rem' }}>
                                        <em>Database:</em>{' '}
                                        {diff.db_change}
                                    </p>
                                )}

                                {/* Table change */}
                                {diff?.table_change && (
                                    <p style={{ marginBottom: '0.1rem', borderRadius: '8px', border: 'transparent', color: '#000000', backgroundColor: '#00b7ff', padding: '0.5rem' }}>
                                        <em>Table:</em>{' '}
                                        {diff.table_change}
                                    </p>
                                )}

                                {/* Query changes */}
                                {hasColumnChanges && (
                                    <>
                                    <em>Column Changes:</em>   
                                    <div style={{border:"2px solid black", borderRadius: "4px", padding: "0.3rem"}}>
                                        {allColumnParents.map((parent) => {
                                            const parentView = getParentStyle(parent);
                                            return (
                                                <div key={"column-parent-" + parent}>
                                                    <p style={parentView.style}>
                                                        {parentView.prefix ? (
                                                            <>
                                                                <strong>{parentView.prefix}</strong>
                                                                {parentView.label}
                                                            </>
                                                        ) : (
                                                            <strong>{parentView.label}</strong>
                                                        )}
                                                    </p>

                                                    {(addedFkByParent[parent] || []).map((fkLabel, idx) => (
                                                        <p key={"added-fk-child-" + parent + "-" + idx} style={{ marginBottom: '0.0rem', marginLeft: '1rem', borderRadius: '8px', border: 'transparent', color: '#000000', backgroundColor: '#6edb77', padding: '0.4rem', fontStyle: 'italic' }}>
                                                            <strong>+FK</strong> {fkLabel}
                                                        </p>
                                                    ))}

                                                    {(removedFkByParent[parent] || []).map((fkLabel, idx) => (
                                                        <p key={"removed-fk-child-" + parent + "-" + idx} style={{ marginBottom: '0.0rem', marginLeft: '1rem', borderRadius: '8px', border: 'transparent', color: '#000000', backgroundColor: '#ff8a8a', padding: '0.4rem', fontStyle: 'italic' }}>
                                                            <strong>-FK</strong> {fkLabel}
                                                        </p>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    </>
                                )}
                                {/* Where clauses */}
                                {(diff?.query_added?.where?.length > 0 || diff?.query_removed?.where?.length > 0) && (
                                    <>
                                    <em>Where Clauses:</em>
                                    <div style={{border:"2px solid black", borderRadius: "4px", padding: "0.3rem"}}>
                                        {diff?.query_added?.where?.length > 0 && (
                                            <>
                                                {diff.query_added.where.map((clause, index) => (
                                                    <p key={index} style={{ marginBottom: '0.1rem', borderRadius: '8px', border: 'transparent', color: '#000000', backgroundColor: '#46cc51', padding: '0.5rem' }}>
                                                        <strong>+</strong>{clause}
                                                    </p>
                                                ))}
                                            </>
                                        )}
                                        {diff?.query_removed?.where?.length > 0 && (
                                            <>
                                                {diff.query_removed.where.map((clause, index) => (
                                                    <p key={index} style={{ marginBottom: '0.1rem', borderRadius: '8px', border: 'transparent', color: '#000000', backgroundColor: '#ff4c4c', padding: '0.5rem' }}>
                                                        <strong>-</strong>{clause}
                                                    </p>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                    </>
                                )}

                                {/* Export Changes */}


                            </div>
                        </>
                    ) : (
                        <p>No entry selected.</p>
                    )}
                </div>
            </Popover>
        </div>
    );
}
