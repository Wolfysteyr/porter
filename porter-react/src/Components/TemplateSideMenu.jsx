import Select from "react-select";
import Tippy from "@tippyjs/react";
import Switch from "react-switch";
import FRRuleField from "./FRRuleField.jsx";
import LimitOffsetRuleField from "./LimitOffsetRuleField.jsx";
import ColumnNameChange from "./ColumnNameChange.jsx";


    // all logic is handled by the useQueryBuilder hook, this is just the visual component

export default function TemplateSideMenu(props) {

    // Destructure all props
    const {
        isMenuOpen,
        selectedTable,
        selectedDatabase,
        updatedData,
        handleFetchTableData,
        handleMenuToggle,
        templateNameErrMsg,
        templateNameErr,
        setTemplateName,
        templateName,
        handleSaveTemplate,
        databases,
        tables,
        handleNewDatabase,
        setSelectedTable,
        menus,
        toggleMenus,
        resetRules,
        rowLimit,
        setRowLimit,
        tableCols,
        foreignKeys,
        selectedCols,
        selectedRFKs,
        selectedColsCount,
        selectedRFKsCount,
        handleChange,
        toggleUI,
        isToggled,
        handleFKSelection,
        selectedWhere,
        WHERE_OPERATORS,
        handleSelectedWhere,
        handleWhereOperatorChange,
        handleWhereValueChange,
        exportType,
        toggleExportType,
        showWarning,
        setShowWarning,
        populateFindOptions,
        targetDatabase,
        setTargetDatabase,
        targetTable,
        setTargetTable,
        dbTables,
        addFRRule,
        addLimitOffset,
        removeFRRule,
        handleFRRuleChange,
        removeLimitOffsetRule,
        handleLimitOffsetChange,
        toggleLoading,
        handleColumnNameChange,
        removeColumnChange,
        FRRules,
        limitOffsetRules,
        showColumnWindow,
        setShowColumnWindow,
        setFindOptions,
        findOptions,
        findOptionsLoading,
        columnNameChanges,
        setColumnNameChanges,
        isEditing,
        template,
    } = props;


    return (
        <>
            <div className={`side-menu` + (isMenuOpen ? " open" : "")}>
                <div className="side-menu-header">
                    <span
                        style={{
                            opacity:
                                selectedTable &&
                                selectedDatabase &&
                                updatedData === true
                                    ? 1
                                    : 0,
                        }}
                        className="attention"
                    >
                        !
                    </span>
                    <img
                        src="/icons/refresh-page-option.png"
                        alt="Refresh Preview Table"
                        className="refresh-button"
                        onClick={handleFetchTableData}
                        style={{
                            opacity: selectedDatabase && selectedTable ? 1 : 0,
                        }}
                    />
                    <img
                        src="/icons/gear.png"
                        alt="Menu Icon"
                        className="menu-icon"
                        onClick={handleMenuToggle}
                    />
                </div>
                <div className="side-menu-content">
                    <p className="error">{templateNameErrMsg}</p>
                    <span
                        style={{
                            display: "flex",
                            justifyContent: "left",
                            alignItems: "left",
                            marginBottom: "10px",
                        }}
                    >
                        <input
                            placeholder="Template name"
                            value={templateName}
                            style={{
                                borderColor: templateNameErr
                                    ? "red"
                                    : "initial",
                                width: "50%",
                                marginRight: "10px",
                            }}
                            onChange={(e) =>
                                setTemplateName &&
                                setTemplateName(e.target.value)
                            }
                        />
                        <button
                            onClick={handleSaveTemplate}
                            className="save-template-button"
                            style={{ height: "fit-content" }}
                            disabled={
                                !templateName ||
                                !selectedDatabase ||
                                !selectedTable
                            }
                        >
                            {" "}
                            {isEditing ? "Save Changes" : "Save"}{" "}
                        </button>
                    </span>
                    <hr />
                    <div
                        style={{ width: "50%", margin: "auto auto 20px auto" }}
                    >
                        <label htmlFor="db">Select Database</label>
                        <select
                            id="db"
                            value={selectedDatabase}
                            onChange={(e) =>
                                handleNewDatabase &&
                                handleNewDatabase(e.target.value)
                            }
                            disabled={isEditing}
                        >
                            <option value="">Choose a database</option>
                            {databases &&
                                databases.map((db, index) => (
                                    <option
                                        key={index}
                                        value={
                                            typeof db === "string"
                                                ? db
                                                : (db.name ??
                                                  JSON.stringify(db))
                                        }
                                    >
                                        {typeof db === "string"
                                            ? db
                                            : (db.name ?? JSON.stringify(db))}
                                    </option>
                                ))}
                            <option
                                value="New Database"
                                style={{ fontWeight: "bold" }}
                            >
                                +New Database
                            </option>
                        </select>

                        {Array.isArray(tables) && tables.length > 0 && (
                            <>
                                <label htmlFor="table-select">
                                    Select a table
                                </label>
                                <div style={{ marginTop: 8 }}>
                                    <Select
                                        inputId="table-select"
                                        placeholder="Choose a table"
                                        isClearable
                                        options={tables.map((t) => {
                                            const tableName =
                                                typeof t === "string"
                                                    ? t
                                                    : (t.name ??
                                                      t.table ??
                                                      Object.values(t)[0] ??
                                                      JSON.stringify(t));
                                            return {
                                                value: tableName,
                                                label: tableName,
                                            };
                                        })}
                                        value={
                                            selectedTable
                                                ? {
                                                      value: selectedTable,
                                                      label: selectedTable,
                                                  }
                                                : null
                                        }
                                        onChange={(opt) => {
                                            setSelectedTable &&
                                                setSelectedTable(
                                                    opt ? opt.value : "",
                                                );
                                        }}
                                        styles={{
                                            menu: (provided) => ({
                                                ...provided,
                                                zIndex: 9999,
                                                backgroundColor: "#424242",
                                                color: "#fff",
                                            }),
                                            control: (provided) => ({
                                                ...provided,
                                                margin: "1rem",
                                                backgroundColor: "#424242",
                                                color: "#fff",
                                            }),
                                            singleValue: (provided) => ({
                                                ...provided,
                                                color: "#fff",
                                            }),
                                            width: "fit-content",
                                        }}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <div
                        className={
                            `rules-section` + (selectedTable ? " open" : "")
                        }
                    >
                        <hr />
                        <div className="rules-header">
                            <h3>Rules</h3>{" "}
                            <Tippy content="Reset all rules">
                                <img
                                    src="icons/undo.png"
                                    alt="Reset Icon"
                                    className="reset-icon"
                                    onClick={() => {
                                        resetRules && resetRules();
                                    }}
                                />
                            </Tippy>
                            <input
                                type="number"
                                placeholder="Preview row limit"
                                style={{ width: "50%" }}
                                value={rowLimit}
                                onChange={(e) =>
                                    setRowLimit && setRowLimit(e.target.value)
                                }
                            />
                        </div>
                        <div
                            className={
                                `rule-item` +
                                (menus && menus["column-menu"] ? " open" : "")
                            }
                            onClick={() =>
                                toggleMenus && toggleMenus("column-menu")
                            }
                        >
                            <label>
                                Columns (
                                {selectedColsCount === 0 &&
                                selectedRFKsCount === 0
                                    ? "All"
                                    : selectedColsCount === 0 &&
                                        selectedRFKsCount > 0
                                      ? `All + ${selectedRFKsCount} fks`
                                      : `${selectedColsCount} cols${selectedRFKsCount ? `, ${selectedRFKsCount} fks` : ""}`}
                                )
                            </label>
                            <strong>
                                {menus && menus["column-menu"] ? "<" : ">"}
                            </strong>
                        </div>
                        <div
                            className={
                                `rule-submenu` +
                                (menus && menus["column-menu"] ? " open" : "")
                            }
                        >
                            {Array.isArray(tableCols) &&
                                tableCols.map((col) => {
                                    const fk = Array.isArray(
                                        Object.values(foreignKeys || {}),
                                    )
                                        ? Object.values(foreignKeys).find(
                                              (fk) => fk.column_name === col,
                                          )
                                        : undefined;
                                    return (
                                        <div key={col} className="column-item">
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        (Array.isArray(
                                                            selectedCols,
                                                        ) &&
                                                            selectedCols.includes(
                                                                col,
                                                            )) ||
                                                        (isEditing &&
                                                            selectedRFKs &&
                                                            selectedRFKs[col])
                                                    }
                                                    onChange={() =>
                                                        handleChange &&
                                                        handleChange(col)
                                                    }
                                                />
                                                {col}
                                                {fk && (
                                                    <label
                                                        onClick={() =>
                                                            toggleUI
                                                                ? toggleUI(
                                                                      fk.constraint_name,
                                                                  )
                                                                : console
                                                        }
                                                        style={{
                                                            cursor: "pointer",
                                                            marginLeft: "8px",
                                                        }}
                                                    >
                                                        {isToggled &&
                                                        isToggled(
                                                            fk.constraint_name,
                                                        )
                                                            ? "-"
                                                            : "+"}
                                                    </label>
                                                )}
                                            </label>
                                            {fk &&
                                                isToggled &&
                                                isToggled(
                                                    fk.constraint_name,
                                                ) && (
                                                    <div
                                                        className="nested"
                                                        style={{
                                                            marginLeft: "16px",
                                                        }}
                                                    >
                                                        <label
                                                            onClick={() =>
                                                                toggleUI &&
                                                                toggleUI(
                                                                    `${fk.constraint_name}-table`,
                                                                )
                                                            }
                                                        >
                                                            <strong>
                                                                {
                                                                    fk.referenced_table
                                                                }
                                                            </strong>{" "}
                                                            {isToggled &&
                                                            isToggled(
                                                                `${fk.constraint_name}-table`,
                                                            )
                                                                ? "-"
                                                                : "+"}
                                                        </label>
                                                        {isToggled &&
                                                            isToggled(
                                                                `${fk.constraint_name}-table`,
                                                            ) && (
                                                                <div
                                                                    style={{
                                                                        marginLeft:
                                                                            "16px",
                                                                    }}
                                                                >
                                                                    {fk.referenced_table_columns.map(
                                                                        (
                                                                            fkcol,
                                                                            i,
                                                                        ) =>
                                                                            fkcol ===
                                                                            fk.referenced_column ? null : (
                                                                                <div
                                                                                    key={
                                                                                        i
                                                                                    }
                                                                                    className="fk-details"
                                                                                >
                                                                                    <label>
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={
                                                                                                Array.isArray(
                                                                                                    selectedRFKs &&
                                                                                                        selectedRFKs[
                                                                                                            fk
                                                                                                                .column_name
                                                                                                        ],
                                                                                                ) &&
                                                                                                selectedRFKs[
                                                                                                    fk
                                                                                                        .column_name
                                                                                                ].includes(
                                                                                                    fkcol,
                                                                                                )
                                                                                            }
                                                                                            onChange={() =>
                                                                                                handleFKSelection &&
                                                                                                handleFKSelection(
                                                                                                    fk.column_name,
                                                                                                    fk.referenced_table,
                                                                                                    fkcol,
                                                                                                )
                                                                                            }
                                                                                        />
                                                                                        {
                                                                                            fkcol
                                                                                        }
                                                                                    </label>
                                                                                </div>
                                                                            ),
                                                                    )}
                                                                </div>
                                                            )}
                                                    </div>
                                                )}
                                        </div>
                                    );
                                })}
                        </div>

                        <div
                            className={
                                `rule-item` +
                                (menus && menus["where-menu"] ? " open" : "")
                            }
                            onClick={() =>
                                toggleMenus && toggleMenus("where-menu")
                            }
                        >
                            <label>
                                Where Statements (
                                {Array.isArray(selectedWhere) &&
                                selectedWhere.length > 0
                                    ? selectedWhere.length
                                    : "none"}
                                )
                            </label>{" "}
                            <strong>
                                {menus && menus["where-menu"] ? "<" : ">"}
                            </strong>
                        </div>
                        <div
                            className={
                                `rule-submenu` +
                                (menus && menus["where-menu"] ? " open" : "")
                            }
                        >
                            <div className="whereSection" id="whereSection">
                                {(() => {
                                    const fkList = Array.isArray(foreignKeys)
                                        ? foreignKeys
                                        : Object.values(foreignKeys || {});
                                    const fkOptions = fkList.flatMap((fk) =>
                                        Array.isArray(
                                            fk.referenced_table_columns,
                                        )
                                            ? fk.referenced_table_columns
                                                  .filter(
                                                      (c) =>
                                                          c !==
                                                          fk.referenced_column,
                                                  )
                                                  .map(
                                                      (c) =>
                                                          `${fk.referenced_table}.${c}`,
                                                  )
                                            : [],
                                    );
                                    const combinedOptions = Array.from(
                                        new Set([
                                            ...(Array.isArray(tableCols)
                                                ? tableCols
                                                : Object.keys(tableCols || {})),
                                            ...fkOptions,
                                        ]),
                                    );
                                    const optionsList = combinedOptions;
                                    const selected = Array.isArray(
                                        selectedWhere,
                                    )
                                        ? selectedWhere
                                        : [];

                                    return (
                                        <>
                                            {selected.map((row, idx) => {
                                                const currentCol =
                                                    row?.column ?? "";
                                                const opts = optionsList.filter(
                                                    (o) =>
                                                        o === currentCol ||
                                                        !selected.some(
                                                            (s) =>
                                                                s.column === o,
                                                        ),
                                                );
                                                return (
                                                    <div
                                                        key={idx}
                                                        style={{
                                                            display: "flex",
                                                            gap: 8,
                                                            alignItems:
                                                                "center",
                                                            marginBottom: 8,
                                                        }}
                                                    >
                                                        <select
                                                            value={currentCol}
                                                            onChange={(e) =>
                                                                handleSelectedWhere &&
                                                                handleSelectedWhere(
                                                                    e,
                                                                    idx,
                                                                )
                                                            }
                                                        >
                                                            <option value="">
                                                                -- Choose Column
                                                                --
                                                            </option>
                                                            {opts.map((col) => (
                                                                <option
                                                                    key={col}
                                                                    value={col}
                                                                >
                                                                    {col}
                                                                </option>
                                                            ))}
                                                        </select>

                                                        {currentCol && (
                                                            <select
                                                                value={
                                                                    row.operator ??
                                                                    "="
                                                                }
                                                                onChange={(e) =>
                                                                    handleWhereOperatorChange &&
                                                                    handleWhereOperatorChange(
                                                                        idx,
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                            >
                                                                {WHERE_OPERATORS.map(
                                                                    (op) => (
                                                                        <option
                                                                            key={
                                                                                op
                                                                            }
                                                                            value={
                                                                                op
                                                                            }
                                                                        >
                                                                            {op}
                                                                        </option>
                                                                    ),
                                                                )}
                                                            </select>
                                                        )}

                                                        {currentCol &&
                                                            !(
                                                                row.operator ===
                                                                    "IS NULL" ||
                                                                row.operator ===
                                                                    "IS NOT NULL"
                                                            ) && (
                                                                <input
                                                                    type="text"
                                                                    placeholder="value"
                                                                    value={
                                                                        row.value ??
                                                                        ""
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        handleWhereValueChange &&
                                                                        handleWhereValueChange(
                                                                            idx,
                                                                            e
                                                                                .target
                                                                                .value,
                                                                        )
                                                                    }
                                                                />
                                                            )}
                                                    </div>
                                                );
                                            })}

                                            <select
                                                key="extra"
                                                value=""
                                                className="blankSelect"
                                                onChange={(e) =>
                                                    handleSelectedWhere &&
                                                    handleSelectedWhere(
                                                        e,
                                                        selected.length,
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    -- Choose Column --
                                                </option>
                                                {optionsList
                                                    .filter(
                                                        (o) =>
                                                            !selected.some(
                                                                (s) =>
                                                                    s.column ===
                                                                    o,
                                                            ),
                                                    )
                                                    .map((col) => (
                                                        <option
                                                            key={col}
                                                            value={col}
                                                        >
                                                            {col}
                                                        </option>
                                                    ))}
                                            </select>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                        <div
                            className={
                                `rule-item` +
                                (menus && menus["export-menu"] ? " open" : "")
                            }
                            onClick={() => {
                                toggleMenus && toggleMenus("export-menu");
                                (async () => {
                                    const grouped = await populateFindOptions();
                                    setFindOptions &&
                                        setFindOptions(grouped || {});
                                })();
                            }}
                        >
                            <label>Export</label>{" "}
                            <strong>
                                {menus && menus["export-menu"] ? "<" : ">"}
                            </strong>
                        </div>
                        <div
                            className={
                                `rule-submenu-export` +
                                (menus && menus["export-menu"] ? " open" : "")
                            }
                        >
                            <h3>Export Rules</h3>
                            <Tippy
                                className="switch-warning"
                                visible={showWarning}
                                interactive={true}
                                placement="bottom"
                                delay={[100, 50]}
                                content={
                                    exportType ? (
                                        <div>
                                            Use this only when you know the
                                            target database structure.
                                            <br />
                                            <button
                                                onClick={() =>
                                                    setShowWarning &&
                                                    setShowWarning(false)
                                                }
                                            >
                                                OK
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowWarning &&
                                                        setShowWarning(false);
                                                    toggleExportType &&
                                                        toggleExportType();
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        ""
                                    )
                                }
                            >
                                <div>
                                    <span
                                        className={!exportType ? "active" : ""}
                                    >
                                        {" "}
                                        CSV{" "}
                                    </span>
                                    <Switch
                                        onChange={() => {
                                            toggleExportType &&
                                                toggleExportType();
                                            setShowWarning &&
                                                setShowWarning(!exportType);
                                        }}
                                        checked={exportType}
                                        uncheckedIcon={false}
                                        checkedIcon={false}
                                        onColor="#888888"
                                        onHandleColor="#ffffff"
                                        handleDiameter={20}
                                        height={10}
                                        width={40}
                                    />
                                    <span
                                        className={exportType ? "active" : ""}
                                    >
                                        {" "}
                                        DB{" "}
                                    </span>
                                </div>
                            </Tippy>
                            {exportType && (
                                <div style={{ marginTop: "0.5rem" }}>
                                    <label>Target Database</label>{" "}
                                    {!targetDatabase && (
                                        <span className="attention">!</span>
                                    )}
                                    <Select
                                        options={(databases || [])
                                            .filter(
                                                (d) =>
                                                    d.name !== selectedDatabase,
                                            )
                                            .map((d) => ({
                                                value: d.name ?? d,
                                                label: d.name ?? d,
                                            }))}
                                        value={
                                            targetDatabase
                                                ? {
                                                      value: targetDatabase,
                                                      label: targetDatabase,
                                                  }
                                                : null
                                        }
                                        onChange={(opt) => {
                                            const val = opt ? opt.value : "";
                                            setTargetDatabase &&
                                                setTargetDatabase(val);
                                            setTargetTable &&
                                                setTargetTable("");
                                        }}
                                        styles={{
                                            menu: (provided) => ({
                                                ...provided,
                                                zIndex: 9999,
                                                backgroundColor: "#424242",
                                                color: "#fff",
                                            }),
                                            control: (provided) => ({
                                                ...provided,
                                                margin: "1rem",
                                                backgroundColor: "#424242",
                                                color: "#fff",
                                            }),
                                            singleValue: (provided) => ({
                                                ...provided,
                                                color: "#fff",
                                            }),
                                        }}
                                    />
                                    {targetDatabase && (
                                        <>
                                            <label>Target Table</label>{" "}
                                            {!targetTable && (
                                                <span className="attention">
                                                    !
                                                </span>
                                            )}
                                            <Select
                                                options={(dbTables || []).map(
                                                    (t) => ({
                                                        value: t,
                                                        label: t,
                                                    }),
                                                )}
                                                value={
                                                    targetTable
                                                        ? {
                                                              value: targetTable,
                                                              label: targetTable,
                                                          }
                                                        : null
                                                }
                                                onChange={(opt) => {
                                                    setTargetTable &&
                                                        setTargetTable(
                                                            opt
                                                                ? opt.value
                                                                : "",
                                                        );
                                                }}
                                                styles={{
                                                    menu: (provided) => ({
                                                        ...provided,
                                                        zIndex: 9999,
                                                        backgroundColor:
                                                            "#424242",
                                                        color: "#fff",
                                                    }),
                                                    control: (provided) => ({
                                                        ...provided,
                                                        margin: "1rem",
                                                        backgroundColor:
                                                            "#424242",
                                                        color: "#fff",
                                                    }),
                                                    singleValue: (
                                                        provided,
                                                    ) => ({
                                                        ...provided,
                                                        color: "#fff",
                                                    }),
                                                }}
                                            />
                                        </>
                                    )}
                                </div>
                            )}
                            <button
                                className="add-rule-button"
                                onClick={addFRRule}
                            >
                                Add New F&R Rule
                            </button>{" "}
                            <span />
                            <button
                                className="add-rule-button"
                                onClick={addLimitOffset}
                                disabled={
                                    limitOffsetRules &&
                                    limitOffsetRules.length >= 1
                                }
                            >
                                Add Limit/Offset
                            </button>{" "}
                            <span />
                            <button
                                className="add-rule-button"
                                onClick={() => {
                                    setShowColumnWindow &&
                                        setShowColumnWindow(true);
                                    setColumnNameChanges &&
                                        setColumnNameChanges((prev) => [
                                            ...prev,
                                            { original: "", new: "" },
                                        ]);
                                }}
                                disabled={showColumnWindow}
                            >
                                Change Column Names
                            </button>{" "}
                            {!showColumnWindow && exportType && (
                                <span className="attention">!</span>
                            )}
                            {FRRules &&
                                FRRules.map((rule, index) => (
                                    <FRRuleField
                                        key={index}
                                        rule={rule}
                                        index={index}
                                        FRRules={FRRules}
                                        findOptions={findOptions}
                                        findOptionsLoading={findOptionsLoading}
                                        removeFRRule={removeFRRule}
                                        handleFRRuleChange={handleFRRuleChange}
                                    />
                                ))}
                            {limitOffsetRules &&
                                limitOffsetRules.map((rule, index) => (
                                    <LimitOffsetRuleField
                                        key={index}
                                        rule={rule}
                                        index={index}
                                        removeLimitOffsetRule={
                                            removeLimitOffsetRule
                                        }
                                        handleLimitOffsetChange={
                                            handleLimitOffsetChange
                                        }
                                    />
                                ))}
                            {showColumnWindow && (
                                <div className="column-name-change-container">
                                    <Tippy
                                        content={
                                            exportType ? (
                                                <span>
                                                    It is recommended to use
                                                    this as sometimes column
                                                    names may not align
                                                    perfectly with the target
                                                    schema, causing data loss.
                                                </span>
                                            ) : (
                                                <span>
                                                    This will rename columns in
                                                    the exported CSV file.
                                                </span>
                                            )
                                        }
                                    >
                                        <span>ℹ️</span>
                                    </Tippy>
                                    <strong style={{ marginLeft: 6 }}>
                                        Change Column Names
                                    </strong>
                                    <button
                                        onClick={() => {
                                            setShowColumnWindow &&
                                                setShowColumnWindow(false);
                                            setColumnNameChanges &&
                                                setColumnNameChanges([]);
                                            setTargetDatabase &&
                                                setTargetDatabase("");
                                            setTargetTable &&
                                                setTargetTable("");
                                        }}
                                        className="remove-rule-button"
                                    >
                                        ✖
                                    </button>

                                    <div style={{ marginTop: "0.75rem" }}>
                                        {(!columnNameChanges ||
                                            columnNameChanges.length === 0) && (
                                            <div style={{ color: "#999" }}>
                                                No columns added yet.
                                            </div>
                                        )}

                                        {columnNameChanges &&
                                            columnNameChanges.map(
                                                (nameChange, index) =>
                                                    (!exportType ||
                                                        (exportType &&
                                                            targetDatabase &&
                                                            targetTable)) && (
                                                        <>
                                                            <ColumnNameChange
                                                                nameChange={
                                                                    nameChange
                                                                }
                                                                index={index}
                                                                sourceColumns={
                                                                    tableCols
                                                                }
                                                                toggleLoading={
                                                                    toggleLoading
                                                                }
                                                                handleColumnNameChange={
                                                                    handleColumnNameChange
                                                                }
                                                                columnNameChanges={
                                                                    columnNameChanges
                                                                }
                                                                removeColumnChange={
                                                                    removeColumnChange
                                                                }
                                                                exportType={
                                                                    exportType
                                                                }
                                                                targetDatabase={
                                                                    targetDatabase
                                                                }
                                                                targetTable={
                                                                    targetTable
                                                                }
                                                                template={template}
                                                            />
                                                            <br />
                                                        </>
                                                    ),
                                            )}
                                        {(targetDatabase && targetTable) ||
                                        !exportType ? (
                                            <button
                                                onClick={() =>
                                                    setColumnNameChanges &&
                                                    setColumnNameChanges(
                                                        (prev) => [
                                                            ...prev,
                                                            {
                                                                original: "",
                                                                new: "",
                                                            },
                                                        ],
                                                    )
                                                }
                                            >
                                                Add Column
                                            </button>
                                        ) : (
                                            <div style={{ color: "#999" }}>
                                                Select a database and table to
                                                add columns.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
