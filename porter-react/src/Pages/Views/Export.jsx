import React, { useEffect, useState, useCallback} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Fragment } from 'react';
import { useContext } from 'react';
import { AppContext } from '../../Context/AppContext';
import Select from 'react-select';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import Switch from 'react-switch';
import Modal from 'react-modal';

// New: move ColumnNameChange out of Export to preserve its state across parent renders
function ColumnNameChange({
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


                        // <>
                        //     <label>Old Column Name</label>
                        //     <Select
                        //         options={Object.keys(findOptions || {})
                        //         .filter(col => !columnNameChanges.some(change => change.original === col) || col === nameChange?.original)
                        //         .map(col => ({ value: col, label: col }))}
                        //         value={originalName ? { value: originalName, label: originalName } : null}
                        //         onChange={(selected) => {
                        //             const val = selected ? selected.value : '';
                        //             setOriginalName(val);
                        //         }}
                        //         styles={{ menu: (provided) => ({ ...provided, zIndex: 9999, backgroundColor: '#424242', color: '#fff' }), control: (provided) => ({ ...provided, margin: "1rem", backgroundColor: '#424242', color: '#fff' }), singleValue: (provided) => ({ ...provided, color: '#fff' })   }}
                        //     />

                        //     {originalName && (
                        //         <>
                        //                     {targetTable && (
                        //                         <>
                        //                             <label>New Column Name</label>
                        //                             <Select 
                        //                                 // filter out columns already selected as "new" in other entries
                        //                                 options={dbColumns
                        //                                     .filter(col => !columnNameChanges.some(change => change.new === col && change !== nameChange))
                        //                                     .map(col => ({ value: col, label: col }))}
                        //                                 value={targetColumn ? { value: targetColumn, label: targetColumn } : null}
                        //                                 onChange={(selected) => {
                        //                                     const val = selected ? selected.value : '';
                        //                                     setTargetColumn(val);
                        //                                     if (typeof handleColumnNameChange === 'function') {
                        //                                         handleColumnNameChange(index, 'new', val);
                        //                                     }
                        //                                 }}
                        //                                 styles={{ menu: (provided) => ({ ...provided, zIndex: 9999, backgroundColor: '#424242', color: '#fff' }), control: (provided) => ({ ...provided, margin: "1rem", backgroundColor: '#424242', color: '#fff' }), singleValue: (provided) => ({ ...provided, color: '#fff' })   }}
                        //                             />
                        //                         </>
                        //                     )}
                        //                 </>
                        //             )}
                        //         </>
                        //     )}
                        // </>
                 
           


function FRRuleField({ rule, index, FRRules, findOptions, findOptionsLoading, removeFRRule, handleFRRuleChange }) {
        // compute values selected by other FR rules (exclude current index)
        const selectedValues = new Set(
            FRRules
                .map((r, i) => (i !== index ? r.find : null))
                .filter(v => v !== null && v !== undefined && v !== '')
        );

        const groupedOptions = Object.entries(findOptions || {}).map(([col, vals]) => {
            const opts = (Array.isArray(vals) ? vals : []).map((val) => {
                const valueStr = val === null || val === undefined ? '' : String(val);
                return { value: `${col}::${valueStr}`, label: valueStr === '' ? '<empty>' : valueStr };
            }).filter(opt => {
                // Always keep the option if it corresponds to the current rule's selected value
                if (rule.find && (opt.value === rule.find || opt.value.endsWith(`::${rule.find}`))) {
                    return true;
                }
                // Exclude option if any other rule has selected the same value (match by exact or endsWith '::value')
                for (const sv of selectedValues) {
                    if (opt.value === sv || opt.value.endsWith(`::${sv}`)) return false;
                }
                return true;
            });

            return { label: col, options: opts };
        });

        // find selected option object matching the stored rule.find value
        let selectedOption = null;
        if (rule.find) {
            for (const group of groupedOptions) {
                const match = group.options.find(o => o.value === rule.find || o.value.endsWith(`::${rule.find}`));
                 if (match) {
                     selectedOption = match;
                     break;
                 }
             }
             if (!selectedOption) {
                const parts = rule.find.split('::');
                const label = parts.length > 1 ? parts.slice(1).join('::') : parts[0];
                selectedOption = { value: rule.find, label };
             }
         }

        // local state for replace input to avoid focus loss while typing
        const [localReplace, setLocalReplace] = React.useState(rule.replace ?? '');

        // keep localReplace in sync when rule.replace changes from outside
        React.useEffect(() => {
            setLocalReplace(rule.replace ?? '');
        }, [rule.replace]);

        return (
            <div className="FRrule-field">
                <Tippy content='Find the value from the provided list, then replace it with desired text/number/value'>
                    <span>ℹ️</span>
                </Tippy>
                Find & Replace
                <button onClick={() => removeFRRule(index)} className='remove-rule-button'>✖</button>
                <Select
                    options={groupedOptions}
                    value={selectedOption}
                    onChange={(opt) => {
                        const token = opt ? opt.value : '';
                        const value = token.includes('::') ? token.split('::').slice(1).join('::') : token;
                        handleFRRuleChange(index, 'find', value);
                    }}
                    isSearchable={true}
                    isClearable={true}
                    isLoading={findOptionsLoading}
                    placeholder="Find... (type to search)"
                    noOptionsMessage={() => findOptionsLoading ? 'Loading...' : 'No values'}
                    styles={{ menu: (provided) => ({ ...provided, zIndex: 9999, backgroundColor: '#424242', color: '#fff' }), control: (provided) => ({ ...provided, margin: "1rem", backgroundColor: '#424242', color: '#fff'}), singleValue: (provided) => ({ ...provided, color: '#fff' })   }}
                />
                {rule.find && (
                    <>
                        <input
                            type="text"
                            placeholder="Replace with..."
                            value={localReplace}
                            onChange={(e) => setLocalReplace(e.target.value)}
                            onBlur={() => handleFRRuleChange(index, "replace", localReplace)}
                        />
                    </>
                )}
                
            </div>
        );
};

const LimitOffsetRuleField = ({ rule, index, removeLimitOffsetRule, handleLimitOffsetChange }) => {
        const [localLimit, setLocalLimit] = React.useState(rule.limit ?? 1000);
        const [localOffset, setLocalOffset] = React.useState(rule.offset ?? 0);

        React.useEffect(() => {
            setLocalLimit(rule.limit ?? 1000);
        }, [rule.limit]);
        React.useEffect(() => {
            setLocalOffset(rule.offset ?? 0);
        }, [rule.offset]);

        const commitLimit = () => {
            const parsed = Number.isFinite(Number(localLimit)) ? Number(localLimit) : 1000;
            handleLimitOffsetChange(index, 'limit', parsed);
        };
        const commitOffset = () => {
            const parsed = Number.isFinite(Number(localOffset)) ? Number(localOffset) : 0;
            handleLimitOffsetChange(index, 'offset', parsed);
        };

        return (
            <div className="limit-offset-field">
                Limit & Offset
                <button onClick={() => removeLimitOffsetRule(index)} className='remove-rule-button'>✖</button>
                <input
                    type="number"
                    value={localLimit}
                    placeholder='Limit, default 1000'
                    onChange={(e) => setLocalLimit(e.target.value)}
                    onBlur={commitLimit}
                />
                <input
                    type="number"
                    value={localOffset}
                    placeholder='Offset, default 0'
                    onChange={(e) => setLocalOffset(e.target.value)}
                    onBlur={commitOffset}
                />
            </div>
        );
    };


export default function Export() {

    const { appAddress } = useContext(AppContext);

    const [loading, toggleLoading] = useState(false);

    const [disableExport, setDisableExport] = useState(true);
    const [countdownSeconds, setCountdownSeconds] = useState(3);

    

    const location = useLocation();
    const navigate = useNavigate();
    const [template, setTemplate] = useState({});
    const [isQueryHidden, setIsQueryHidden] = useState(true);
    
    const [FRRules, setFRRules] = useState([]); // { find: string, replace: string }, holds find/replace rules
    const [limitOffsetRules, setLimitOffsetRules] = useState([]); // { limit: number, offset: number }, holds limit/offset rule
    const [columnNameChanges, setColumnNameChanges] = useState([]); // { original: string, new: string }, holds list of column name changes
    
    const [showRules, setShowRules] = useState(false);

    const { token } = useContext(AppContext);

    // find options grouped by column: { columnName: [val, ...] }
    const [findOptions, setFindOptions] = useState({});
    const [findOptionsLoading, setFindOptionsLoading] = useState(false);
    const [findOptionsError, setFindOptionsError] = useState(false);

    const [exportType, setExportType] = useState(false); // false = csv export, true = db export

    const toggleExportType = () => {
        setExportType(prev => !prev);
        setColumnNameChanges([]);
        if (exportType) {
            setColumnNameChanges(prev => [...prev, { original: '', new: '' }]);
        }

    };

    const [showWarning, setShowWarning] = useState(false);

    // export to db related
    const [databases, setDatabases] = useState([]);
    const [targetDatabase, setTargetDatabase] = useState('');
    const [dbTables, setDbTables] = useState([]);
    const [targetTable, setTargetTable] = useState('');
    const [showColumnWindow, setShowColumnWindow] = useState(false);



        useEffect(() => {
            // fetch tables when targetDatabase changes
            const fetchTables = async () => {
                if (targetDatabase) {
                    try {
                        toggleLoading(true);
                        const response = await fetch(`${appAddress}/api/databases/external/tables?name=${encodeURIComponent(targetDatabase)}`, {
                            headers: { Authorization: `Bearer ${token}` },
                            method: 'GET'
                        });
                        if (!response.ok) throw new Error(`Status ${response.status}`);
                        const data = await response.json();
                    setDbTables(Array.isArray(data.tables) ? data.tables : []);
                    console.log("Fetched tables for database", targetDatabase, data.tables);
                } catch (err) {
                    console.error("Failed to fetch databases:", err);
                    setDbTables([]);
                } finally {
                    toggleLoading(false);
                }
                }
            };
            fetchTables();
        }, [targetDatabase]);


    useEffect(() => {
            (async () => {
                try {
                    toggleLoading(true);
                    const response = await fetch(`${appAddress}/api/databases/external`, {
                    headers: { Authorization: `Bearer ${token}` }, 
                    method: 'GET'
                });
                if (!response.ok) throw new Error(`Status ${response.status}`);
                    const data = await response.json();
                    setDatabases(Array.isArray(data) ? data : []);
                } catch (err) {
                    console.error("Failed to fetch databases:", err);
                    setDatabases([]);
                } finally {
                    toggleLoading(false);
                }
            }
        )()}, []);
   
 
    useEffect(() => {
        if (location.state && location.state.template) {
            setTemplate(location.state.template);
            navigate(location.pathname, { replace: true, state: {} });
            setDisableExport(true);
        }
    }, [location, navigate]);

    // disable export button for first 3 seconds after page load and show countdown
    useEffect(() => {
        setDisableExport(true);
        setCountdownSeconds(3);
        let remaining = 3;
        const interval = setInterval(() => {
            remaining -= 1;
            setCountdownSeconds(remaining);
            if (remaining <= 0) {
                setDisableExport(false);
                clearInterval(interval);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // when rules panel is opened, populate find options
    useEffect(() => {
        if (showRules && template?.table) {
            (async () => {
                const grouped = await populateFindOptions();
                setFindOptions(grouped || {});
            })();
        }
    }, [showRules, template]);
    
    useEffect(() => {
        if (!template.name) {
            const timer = setTimeout(() => {
                navigate('/templates');
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [template, navigate]);

    useEffect(() => {
        document.title = 'Porter - Export';
    }, []);





    // Add a new empty fr rule
    const addFRRule = () => {
        setFRRules((prev) => [...prev, { find: "", replace: "" }]);
    };

    // Add limit/offset rule
    const addLimitOffset = () => {
        setLimitOffsetRules((prev) => [...prev, { limit: 1000, offset: 0 }]);
    }

 


 
    const handleFRRuleChange = (index, field, value) => {
        setFRRules((prev) =>
        prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
        );
        console.log('Updated FR rules:', FRRules);
    }

    const handleLimitOffsetChange = (index, field, value) => {
        setLimitOffsetRules((prev) =>
            prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
        );
    }

    // make handler stable to avoid re-creating function every render
    const handleColumnNameChange = useCallback((index, field, value) => {
        setColumnNameChanges((prev) =>
            prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
        );
    }, []);


    // Remove find replace rule
    const removeFRRule = (index) => {
        setFRRules((prev) => prev.filter((_, i) => i !== index));
    }

    const removeLimitOffsetRule = (index) => {
        setLimitOffsetRules((prev) => prev.filter((_, i) => i !== index));
    }

    // Remove column name change entry
    const removeColumnChange = (index) => {
        setColumnNameChanges((prev) => prev.filter((_, i) => i !== index));
    }


    async function populateFindOptions() {
        setFindOptionsLoading(true);
        setFindOptionsError(null);
        try {
            const payload = {
                name: template.database,
                columns: template.query?.columns ?? template.columns ?? [],
                where: template.query?.where ?? template.where ?? [],
                foreign_keys: template.query?.foreign_keys ?? template.foreign_keys ?? [],
                limit: 10000, // limit to 1000 rows for performance
            };

            console.log('populateFindOptions payload', payload);

            const response = await fetch(`${appAddress}/api/databases/external/tables/${encodeURIComponent(template.table)}`, {
                method: 'POST', // POST with payload
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const text = await response.text().catch(() => null);
                console.error('Failed to fetch find options', response.status, text);
                setFindOptionsError('Failed to load values');
                setFindOptionsLoading(false);
                return {};
            }


            const data = await response.json(); // expect an array of row objects

            // Group values by column
            const grouped = {};
            data.rows.forEach (row => {
                 Object.entries(row).forEach(([key, val]) => {
                    if (!grouped[key]) {
                        grouped[key] = new Set();
                    }
                    grouped[key].add(val);
                });
            });

            // Convert sets to arrays
            Object.keys(grouped).forEach(key => {
                grouped[key] = Array.from(grouped[key]);   
            });
        
            console.log('populateFindOptions grouped', grouped);
            setFindOptions(grouped);
            setFindOptionsLoading(false);
            return grouped;
        } catch (err) {
            console.error('populateFindOptions error', err);
            setFindOptionsError(true);
            setFindOptionsLoading(false);
            return {};
        }
    }

    


    

    // destructure with safe defaults
    const {
        name = '',
        database = '',
        table = '',
        query = {}
    } = template;

    const columnsCount = query?.columns?.length ?? 0;
    const hasWhere = Array.isArray(query?.where) && query.where.length > 0;

    const renderWhereList = () => {
        if (!hasWhere) return null;
        return (
            <>
                including only records where
                {query.where.map((condition, index) => (
                    <Fragment key={index}>
                        <br />
                        <span>
                            Column <strong>{condition.column} {condition.operator} {condition.value}</strong>
                        </span>
                        <span>{index < query.where.length - 1 ? ', ' : '.'}</span>
                    </Fragment>
                ))}
            </>
        );
    };

    async function handleExport(template) {
        try {
            toggleLoading(true);
            let payload = { 
                ...template,
                find_replace_rules: FRRules,
                limit: limitOffsetRules[0]?.limit ?? 1000, // limit to 1000 rows for performance
                offset: limitOffsetRules[0]?.offset ?? 0,
                column_name_changes: columnNameChanges.filter(c => c.original && c.new), // only include entries with both original and new names
                exportType: exportType ?? 0,
                target_database: exportType ? targetDatabase : undefined,
                target_table: exportType ? targetTable : undefined
            }
            console.log('payload for export', payload);
            const response = await fetch(`${appAddress}/api/export`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.error('Export failed with status:', response.status);
                throw new Error('Failed to export data');
            }
            if (!exportType) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${template.name}_export.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                navigate('/templates', { state: { message: `Export successful! Exported to ${template.name + '_export.csv'}` } });
            } else {
                const data = await response.json();
                navigate('/templates', { state: { message: `Export successful! Exported to  ${targetDatabase}, table ${targetTable}` } });
            }
        } catch (error) {
            console.error('Error exporting data:', error);
            alert('Error exporting data. Please try again later.');
        } finally {
            toggleLoading(false);
            

        }
    }

    return (
        <>
            <h1 className="title">Export</h1>
            <div className="main-div">
                {name ? (
                    <>
                        <div className={`export-container${showRules ? ' with-rules' : ''}`}>
                            <div className='export-template'>
                                <h3>Use Template</h3>
                                <h5 style={{ color: 'white', textDecoration: 'underline' }}>
                                    Please double-check the template before exporting.
                                </h5>

                                <label>Template Name</label>
                                <input type="text" value={name} readOnly style={{ color: 'grey' }} />

                                <label>Database</label>
                                <select defaultValue={database} disabled>
                                    <option value={database}>{database}</option>
                                </select>

                                <label>Table</label>
                                <select defaultValue={table} disabled>
                                    <option value={table}>{table}</option>
                                </select>

                                <label>Query</label>
                                <div>
                                    <Tippy content='Click to see the full query details if you understand them'>
                                    <button
                                        style={{ marginBottom: '1rem' }}
                                        onClick={() => setIsQueryHidden(!isQueryHidden)}
                                    >
                                        

                                        {isQueryHidden ? 'Show Query' : 'Show Simple'}
                                    </button>
                                    </Tippy>
                                    <p
                                        className={isQueryHidden ? `` : `hidden`}
                                        style={{ fontStyle: 'italic', marginTop: '1rem' }}
                                    >
                                        This will export <Tippy
                                            content={
                                                <div style={{ whiteSpace: 'pre', maxWidth: 400 }}>
                                                    {Array.isArray(query.columns)
                                                        ? (query.columns[0] === '*' ? '*' : query.columns.join('\n'))
                                                        : String(query.columns ?? '')}
                                                </div>
                                            }
                                            delay={[150, 50]}
                                            placement="top"
                                        >
                                            <strong
                                                className='columns-count'
                                                aria-label={
                                                    Array.isArray(query.columns)
                                                        ? (query.columns[0] === '*' ? '*' : query.columns.join(', '))
                                                        : String(query.columns ?? '')
                                                }
                                                style={{ textDecoration: 'underline', cursor: 'help' }}
                                            >
                                                { !Array.isArray(query.columns) || query.columns[0] === "*" ? "all" : columnsCount}
                                            </strong>
                                        </Tippy>{' '}
                                        fields from <strong>{database}.{table}</strong>{' '}
                                        
                                        {hasWhere ? renderWhereList() : '.'}
                                    </p>

                                    <textarea
                                        rows="20"
                                        value={JSON.stringify(query, null, 2)}
                                        readOnly
                                        className={isQueryHidden ? `hidden` : ``}
                                        style={{
                                            color: 'grey',
                                            fontFamily: 'monospace',
                                            fontSize: '0.9rem',
                                            width: '50%',
                                            height: 'fit-content'
                                        }}
                                    />
                                </div>
                            </div>
                            {showRules && (
                            <div className='export-rules'>
                                <h3>Export Rules</h3>
                                <Tippy
                                    className='switch-warning'
                                    visible={showWarning}
                                    interactive={true}
                                    placement="bottom"
                                    delay={[100, 50]}
                                    content={exportType ? (
                                        <div>
                                            Use this only when you know the target database structure.
                                            <br />
                                            <button onClick={() => setShowWarning(false)}>OK</button>
                                            <button onClick={() => {setShowWarning(false); toggleExportType();}}>Cancel</button>
                                        </div>
                                    ) : ''}>
                                <div>
                                    <span className={!exportType ? 'active' : ''}> CSV </span>
                                    <Switch
                                        onChange={() => {
                                            toggleExportType();
                                            // show warning only when switching to DB mode
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
                                    <span className={exportType ? 'active' : ''}> DB </span>
                                </div>


                                {/* TODO FIX: when closing Change Column Names window, target db and table get reset, when they shouldn't */}
                                </Tippy>
                                {/* DB/Table selectors only in DB export mode */}
                                        {exportType && (
                                            <div style={{ marginTop: '0.5rem' }}>
                                                <label>Target Database</label>  {!targetDatabase && <span className='attention'>!</span>}
                                                <Select
                                                    options={(databases || [])
                                                        .filter(d => d.name !== template.database) // filters out the template database
                                                        .map(d => ({ value: d.name ?? d, label: d.name ?? d }))}
                                                    value={targetDatabase ? { value: targetDatabase, label: targetDatabase } : null}
                                                    onChange={(opt) => { const val = opt ? opt.value : ''; setTargetDatabase(val); setTargetTable(''); setDbTables([]); }}
                                                    styles={{ menu: (provided) => ({ ...provided, zIndex: 9999, backgroundColor: '#424242', color: '#fff' }), control: (provided) => ({ ...provided, margin: "1rem", backgroundColor: '#424242', color: '#fff' }), singleValue: (provided) => ({ ...provided, color: '#fff' })   }}
                                                />
                                                {targetDatabase && (
                                                    <>
                                                        <label>Target Table</label>  {!targetTable && <span className='attention'>!</span>}
                                                        <Select
                                                            options={(dbTables || []).map(t => ({ value: t, label: t }))}
                                                            value={targetTable ? { value: targetTable, label: targetTable } : null}
                                                            onChange={(opt) => {setTargetTable(opt ? opt.value : ''); }}
                                                            styles={{ menu: (provided) => ({ ...provided, zIndex: 9999, backgroundColor: '#424242', color: '#fff' }), control: (provided) => ({ ...provided, margin: "1rem", backgroundColor: '#424242', color: '#fff' }), singleValue: (provided) => ({ ...provided, color: '#fff' })   }}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        )}
                                <button className="add-rule-button" onClick={addFRRule}>Add New F&R Rule</button> <span/>
                                <button className='add-rule-button' onClick={addLimitOffset} disabled={limitOffsetRules.length >= 1}>Add Limit/Offset</button> <span/>
                                <button className='add-rule-button' onClick={() => { setShowColumnWindow(true); setColumnNameChanges(prev => [...prev, { original: '', new: '' }]) }} disabled={showColumnWindow}>Change Column Names</button> {!showColumnWindow && exportType && <span className='attention'>!</span>}

                                {FRRules.map((rule, index) => (
                                    <FRRuleField key={index} rule={rule} index={index} FRRules={FRRules} findOptions={findOptions} findOptionsLoading={findOptionsLoading} removeFRRule={removeFRRule} handleFRRuleChange={handleFRRuleChange} />
                                ))}
                                {limitOffsetRules.map((rule, index) => (
                                    <LimitOffsetRuleField key={index} rule={rule} index={index} removeLimitOffsetRule={removeLimitOffsetRule} handleLimitOffsetChange={handleLimitOffsetChange} />
                                ))}
                                {/* Change Column Names window - only visible when opened */}
                                {showColumnWindow && (
                                    <div className="column-name-change-container">
                                        <Tippy content={ exportType ? 
                                            <span>It is recommended to use this as sometimes column names may not align perfectly with the target schema, causing data loss.</span>
                                            : 
                                            <span>This will rename columns in the exported CSV file.</span>}>
                                            <span>ℹ️</span>
                                        </Tippy>
                                        <strong style={{ marginLeft: 6 }}>Change Column Names</strong>
                                        <button onClick={() => {
                                                // Close window and clear all column changes
                                                setShowColumnWindow(false);
                                                setColumnNameChanges([]);
                                                setTargetDatabase('');
                                                setTargetTable('');
                                                setDbTables([]);
                                            }} className='remove-rule-button'>✖</button>

                                        

                                        

                                        <div style={{ marginTop: '0.75rem' }}>
                                            {columnNameChanges.length === 0 && <div style={{ color: '#999' }}>No columns added yet.</div>}

                                            {columnNameChanges.map((nameChange, index) => (
                                                // show mapping rows only if CSV mode OR (DB mode + both DB & table selected)
                                                ((!exportType) || (exportType && targetDatabase && targetTable)) && (
                                                    <>
                                                        <ColumnNameChange
                                                            nameChange={nameChange}
                                                            index={index}
                                                            findOptions={findOptions}
                                                            toggleLoading={toggleLoading}
                                                            handleColumnNameChange={handleColumnNameChange}
                                                            columnNameChanges={columnNameChanges}
                                                            removeColumnChange={removeColumnChange}
                                                            exportType={exportType}
                                                            targetDatabase={targetDatabase}
                                                            targetTable={targetTable}
                                                        />
                                                        <br />

                                                        </>
                                                        
                                                )
                                            ))}
                                           {targetDatabase && targetTable ? (
                                               <button onClick={() => setColumnNameChanges(prev => [...prev, { original: '', new: '' }])}>Add Column</button>
                                           ) : (
                                               <div style={{ color: '#999' }}>Select a database and table to add columns.</div>
                                           )}

                                        </div>
                                    </div>
                                )}
                                


                            </div>
                            )}
                        </div>
                    <>
                        <br />
                        <br />
                        {disableExport && (
                                <span style={{ marginLeft: 10, color: '#ccc', fontSize: '0.9rem' }}>
                                   {countdownSeconds}s
                               </span>
                            )}
                        <Tippy 
                            content={showRules ? 'Export Data' : 'No rules applied, This will export all data to CSV' }
                            delay={showRules ? [1000, 50] : [100, 50]}
                            className={showRules ? '' : 'no-rules-warning'}
                            >
                            
                            
                            <button
                                className="export-button"
                                onClick={() => handleExport(template)}
                                disabled={disableExport}
                                style={{ cursor: disableExport ? 'not-allowed' : 'pointer' }}
                            >
                                Export
                            </button>
                            
                        </Tippy>
                        
                        {!showRules && (
                            <button className="export-button" onClick={() => setShowRules(true)}>
                                Open Rules
                            </button>
                        )}
                    </>
                </>
                ) : (
                    <>
                        <p>No template selected, redirecting...</p>
                        <span className="loader"></span>
                    </>
                )}
            </div>

            {/* Loading modal */}
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
    );
}