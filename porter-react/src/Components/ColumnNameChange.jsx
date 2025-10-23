import React, { useEffect, useState, useContext } from 'react';
import Select from 'react-select';
import { AppContext } from '../Context/AppContext';

export default function ColumnNameChange({
    nameChange,
    index,
    findOptions,
    targetDatabase,
    targetTable,
    toggleLoading,
    handleColumnNameChange,
    columnNameChanges,
    removeColumnChange,
    exportType,

}) {
    const { appAddress, token } = useContext(AppContext);
    const [originalName, setOriginalName] = useState(nameChange.original ?? '');
    const [newNameCSV, setNewNameCSV] = useState(nameChange.new ?? '');
    

   const [dbColumns, setDbColumns] = useState([]);
    const [targetColumn, setTargetColumn] = useState('');

    // keep local fields in sync if parent updates nameChange
    useEffect(() => {
        setOriginalName(nameChange.original ?? '');
        setNewNameCSV(nameChange.new ?? '');
        
        if (!nameChange?.new) setTargetColumn('');
    }, [nameChange]);
    
    // sync local edits back to parent state — avoid infinite loop by limiting when we push changes
    useEffect(() => {
        // CSV mode: only persist originalName immediately (select). Commit "new" onBlur to avoid rapid
        // parent updates while typing which cause re-renders/reset and can loop.
        if (!exportType) {
            if (typeof handleColumnNameChange === 'function') {
                const parentOriginal = nameChange?.original ?? '';
                if (parentOriginal !== (originalName ?? '')) {
                    handleColumnNameChange(index, 'original', originalName);
                }
            }
            return;
        }

        // DB mode: persist original + new string
        if (exportType) {
            if (typeof handleColumnNameChange === 'function') {
                const parentOriginal = nameChange?.original ?? '';
                const parentNew = nameChange?.new ?? '';
                if (parentOriginal !== (originalName ?? '') || parentNew !== (targetColumn ?? '')) {
                    handleColumnNameChange(index, 'original', originalName);
                    handleColumnNameChange(index, 'new', targetColumn);
                }
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        originalName,
        targetColumn,
        exportType,
        index,
        handleColumnNameChange,
        nameChange?.original,
        nameChange?.new
    ]);


    useEffect(() => {
        // fetch columns when targetTable changes
        const fetchColumns = async () => {
            if (targetTable) {
                try {
                    toggleLoading(true);
                    const response = await fetch(`${appAddress}/api/databases/external/tables/${encodeURIComponent(targetTable)}/columns?name=${encodeURIComponent(targetDatabase)}`, {
                        headers: { Authorization: `Bearer ${token}` },
                        method: 'GET'
                    });

                    if (!response.ok) throw new Error(`Status ${response.status}`);
                    const data = await response.json();
                    setDbColumns(Array.isArray(data.columns) ? data.columns : []);
                    console.log("Fetched columns for table", targetTable, data.columns);
                } catch (err) {
                    console.error("Failed to fetch columns:", err);
                    setDbColumns([]);
                } finally {
                    toggleLoading(false);
                }
            }
        };
        fetchColumns();
    }, [targetTable]);

    return (
            <div className="column-name-change-field">
                <span style={{fontWeight: "500", fontSize: "large", textDecoration: originalName ? "underline" : "none"}}>{originalName ? originalName : "..."}</span>
                <button onClick={() => removeColumnChange(index)} className='remove-rule-button'>✖</button>
                <br />
                <div className='name-change-inputs'>
                    {!exportType ? (
                        <>
                            <label>Old Column Name</label>
                            <Select
                                // filtered: remove columns already chosen in other entries (old or new)
                                options={Object.keys(findOptions || {})
                                    .filter(col => !nameChange?.original?.includes(col) && !nameChange?.new?.includes(col))
                                    .map(col => ({ value: col, label: col }))}
                                value={originalName ? { value: originalName, label: originalName } : null}
                                onChange={(selected) => {
                                    const val = selected ? selected.value : '';
                                    setOriginalName(val);
                                }}
                                styles={{ menu: (provided) => ({ ...provided, zIndex: 9999, backgroundColor: '#424242', color: '#fff' }), control: (provided) => ({ ...provided, margin: "1rem", backgroundColor: '#424242', color: '#fff' }), singleValue: (provided) => ({ ...provided, color: '#fff' })   }}
                            />
                            {originalName && (
                                <>
                                    <label>New Column Name</label>
                                    <input
                                        type="text"
                                        placeholder='New Column Name'
                                        value={newNameCSV}
                                        onChange={(e) => setNewNameCSV(e.target.value)}
                                        onBlur={() => {
                                            if (typeof handleColumnNameChange === 'function') {
                                                handleColumnNameChange(index, 'new', String(newNameCSV || '').trim());
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.currentTarget.blur();
                                            }
                                        }}
                                    />
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {targetDatabase && targetTable && (
                                <>
                                    <label>Old Column Name</label>
                                    <Select
                                        // filtered: remove columns already chosen in other entries (old or new)
                                        options={Object.keys(findOptions || {})
                                            .filter(col => !columnNameChanges.some(change => change.original === col) || col === nameChange?.original)
                                            .map(col => ({ value: col, label: col }))}
                                        value={originalName ? { value: originalName, label: originalName } : null}
                                        onChange={(selected) => {
                                            const val = selected ? selected.value : '';
                                            setOriginalName(val);
                                        }}
                                        styles={{ menu: (provided) => ({ ...provided, zIndex: 9999, backgroundColor: '#424242', color: '#fff' }), control: (provided) => ({ ...provided, margin: "1rem", backgroundColor: '#424242', color: '#fff' }), singleValue: (provided) => ({ ...provided, color: '#fff' })   }}
                                    />
                                    {originalName && (
                                        <>
                                            <label>New Column Name</label>
                                            <Select
                                                // filter out columns already selected as "new" in other entries
                                                options={dbColumns
                                                    .filter(col => !columnNameChanges.some(change => change.new === col && change !== nameChange))
                                                    .map(col => ({ value: col, label: col }))}
                                                value={targetColumn ? { value: targetColumn, label: targetColumn } : null}
                                                onChange={(selected) => {
                                                    const val = selected ? selected.value : '';
                                                    setTargetColumn(val);
                                                }}
                                                styles={{ menu: (provided) => ({ ...provided, zIndex: 9999, backgroundColor: '#424242', color: '#fff' }), control: (provided) => ({ ...provided, margin: "1rem", backgroundColor: '#424242', color: '#fff' }), singleValue: (provided) => ({ ...provided, color: '#fff' })   }}
                                            />
                                        </>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
}