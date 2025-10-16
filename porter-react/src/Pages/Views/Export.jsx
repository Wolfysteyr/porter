import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Fragment } from 'react';
import { useContext } from 'react';
import { AppContext } from '../../Context/AppContext';
import Select from 'react-select';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import Switch from 'react-switch';

export default function Export() {

    const { appAddress } = useContext(AppContext);

    const location = useLocation();
    const navigate = useNavigate();
    const [template, setTemplate] = useState({});
    const [isQueryHidden, setIsQueryHidden] = useState(true);
    
    const [FRRules, setFRRules] = useState([]);
    const [limitOffsetRules, setLimitOffsetRules] = useState([]);
    const [columnNameChanges, setColumnNameChanges] = useState([]); // { original: string, new: string }
    const [showRules, setShowRules] = useState(false);

    const { token }  = useContext(AppContext);

    // find options grouped by column: { columnName: [val, ...] }
    const [findOptions, setFindOptions] = useState({});
    const [findOptionsLoading, setFindOptionsLoading] = useState(false);
    const [findOptionsError, setFindOptionsError] = useState(false);
 
    useEffect(() => {
        if (location.state && location.state.template) {
            setTemplate(location.state.template);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate]);

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

    const addNewColName = () => {
        setColumnNameChanges((prev) => [...prev, { original: "", new: "" }]);
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

    const handleColumnNameChange = (index, field, value) => {
        setColumnNameChanges((prev) =>
            prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
        );
    }


    // Remove find replace rule
    const removeFRRule = (index) => {
        setFRRules((prev) => prev.filter((_, i) => i !== index));
    }

    const removeLimitOffsetRule = (index) => {
        setLimitOffsetRules((prev) => prev.filter((_, i) => i !== index));
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
            data.rows.forEach(row => {
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

    const FRRuleField = ({ rule, index }) => {
        // build grouped options for react-select from findOptions state

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
                // accept either stored as 'col::value' or just 'value'
                const match = group.options.find(o => o.value === rule.find || o.value.endsWith(`::${rule.find}`));
                 if (match) {
                     selectedOption = match;
                     break;
                 }
             }
             // if not found, still show the raw token so user can clear it
             if (!selectedOption) {
                const parts = rule.find.split('::');
                const label = parts.length > 1 ? parts.slice(1).join('::') : parts[0];
                selectedOption = { value: rule.find, label };
             }
         }

        // local state for replace input to avoid focus loss while typing
        const [localReplace, setLocalReplace] = useState(rule.replace ?? '');

        // keep localReplace in sync when rule.replace changes from outside
        useEffect(() => {
            setLocalReplace(rule.replace ?? '');
        }, [rule.replace]);

        return (
            <div className="FRrule-field">
                <Tippy content='Find the value from the provided list, then replace it with desired text/number/value'>
                    <span>ℹ️</span>
                </Tippy>
                Find & Replace
                <button onClick={() => removeFRRule(index)}>✖</button>
                <Select
                    options={groupedOptions} // shows "column::value" in value, but excludes already selected values
                    value={selectedOption}
                    onChange={(opt) => {
                        const token = opt ? opt.value : '';
                        // extract only the value after '::' if present
                        const value = token.includes('::') ? token.split('::').slice(1).join('::') : token;
                        handleFRRuleChange(index, 'find', value);
                    }}
                    isSearchable={true}
                    isClearable={true}
                    isLoading={findOptionsLoading}
                    placeholder="Find... (type to search)"
                    noOptionsMessage={() => findOptionsLoading ? 'Loading...' : 'No values'}
                    styles={{ menu: (provided) => ({ ...provided, zIndex: 9999, backgroundColor: '#424242', color: '#fff' }), control: (provided) => ({ ...provided, margin: "1rem", backgroundColor: '#424242', color: '#fff' }), singleValue: (provided) => ({ ...provided, color: '#fff' })   }}
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


    const LimitOffsetRuleField = ({ rule, index }) => {
        // local buffering for numeric inputs to avoid focus loss while typing
        const [localLimit, setLocalLimit] = useState(rule.limit ?? 1000);
        const [localOffset, setLocalOffset] = useState(rule.offset ?? 0);

        useEffect(() => {
            setLocalLimit(rule.limit ?? 1000);
        }, [rule.limit]);
        useEffect(() => {
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
                <button onClick={() => removeLimitOffsetRule(index)}>✖</button>
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

    // field for export column name change

    const ColumnNameChange = ({ nameChange, index }) => {

        // async function which fetches all column names from the source table


        // async function with fetches all column names from the target database table


        const [originalName, setOriginalName] = useState(nameChange.original);
        const [newName, setNewName] = useState(nameChange.new);
        const [exportType, toggleExportType] = useState(false); // false = csv export, true = db export
        const [showWarning, setShowWarning] = useState(false);

        const commitOriginal = () => {
            handleColumnNameChange(index, 'original', originalName);
        }
        const commitNew = () => {
            handleColumnNameChange(index, 'new', newName);
        }

        useEffect(() => {
            setOriginalName("");
        }, [exportType]);
        useEffect(() => {
            setNewName("");
        }, [exportType]);


        return (
            <div className="column-name-change-container">
                Change Column Name
                <div className="column-name-change-field">
                    <span style={{fontWeight: "500", fontSize: "large", textDecoration: originalName ? "underline" : "none"}}>{originalName ? originalName : "..."}</span>
                    <br />
                    <span>Export Type</span>
                    <br />
                    <Tippy
                        className='switch-warning'
                        visible={showWarning}
                        interactive={true}
                        placement="top"
                        delay={[100, 50]}
                        content={exportType ? (
                            <div>
                                Use this only when you know the target database structure.
                                <br />
                                <button onClick={() => setShowWarning(false)}>OK</button>
                                <button onClick={() => {setShowWarning(false); toggleExportType(false);}}>Cancel</button>
                            </div>
                        ) : ''}> 
                    <div>
                     <span className={!exportType ? 'active' : ''}> CSV </span>
                        <Switch
                            onChange={() => {toggleExportType(!exportType); setShowWarning(!exportType);}}
                            checked={exportType}
                            uncheckedIcon={false}
                            checkedIcon={false}
                            onColor="#888888"
                            onHandleColor="#ffffff"
                            handleDiameter={20}
                            height={10}
                            width={40}
                            onBlur={commitOriginal}
                            // add warning if switching type to db like "only do this if you know which data goes where"
                        />
                        
                        <span className={exportType ? 'active' : ''}> DB </span>
                        </div>
                    </Tippy>
                    <div className='name-change-inputs'>
                        {!exportType ? (
                            <> 
                                <label>Old Column Name</label>
                                <Select
                                    options={Object.keys(findOptions || {}).map(col => ({ value: col, label: col }))}
                                    value={originalName ? { value: originalName, label: originalName } : null}
                                    onChange={(selected) => setOriginalName(selected ? selected.value : '')}
                                    styles={{ menu: (provided) => ({ ...provided, zIndex: 9999, backgroundColor: '#424242', color: '#fff' }), control: (provided) => ({ ...provided, margin: "1rem", backgroundColor: '#424242', color: '#fff' }), singleValue: (provided) => ({ ...provided, color: '#fff' })   }}

                                />
                                {originalName && (
                                    <>
                                        <label>New Column Name</label>
                                        <input
                                            type="text"
                                            placeholder='New Column Name'
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            onBlur={commitNew}
                                        />
                                    </>
                                )}
                            </>
                        ) : (
                            <>           

                                {/* DB export mode: old column name -> target db, target table, new column name */}            
                                <label>Old Column Name</label>
                                <Select
                                    options={Object.keys(findOptions || {}).map(col => ({ value: col, label: col }))}
                                    value={originalName ? { value: originalName, label: originalName } : null}
                                    onChange={(selected) => setOriginalName(selected ? selected.value : '')}
                                    styles={{ menu: (provided) => ({ ...provided, zIndex: 9999, backgroundColor: '#424242', color: '#fff' }), control: (provided) => ({ ...provided, margin: "1rem", backgroundColor: '#424242', color: '#fff' }), singleValue: (provided) => ({ ...provided, color: '#fff' })   }}
                                />

                                
                            </>

                        )}
                    </div>
                </div>
            </div>
        );
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
            let payload = { 
                ...template,
                find_replace_rules: FRRules,
                limit: limitOffsetRules[0]?.limit ?? 1000, // limit to 1000 rows for performance
                offset: limitOffsetRules[0]?.offset ?? 0,
            }
            console.log('payload for export', payload);
            const response = await fetch(`${appAddress}/api/databases/external/export`, {
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

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${template.table}_export.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting data:', error);
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
                                <button className="add-rule-button" onClick={addFRRule}>Add New F&R Rule</button>
                                <button className='add-rule-button' onClick={addLimitOffset} disabled={limitOffsetRules.length >= 1}>Add Limit/Offset</button>
                                <button className='add-rule-button' onClick={addNewColName}>Change Column Name</button>

                                {FRRules.map((rule, index) => (
                                    <FRRuleField key={index} rule={rule} index={index} />
                                ))}
                                {limitOffsetRules.map((rule, index) => (
                                    <LimitOffsetRuleField key={index} rule={rule} index={index} />
                                ))}
                                {columnNameChanges.map((nameChange, index) => (
                                    <ColumnNameChange key={index} nameChange={nameChange} index={index} />
                                ))}
                                


                            </div>
                            )}
                        </div>
                    <>
                        <button
                            className="export-button"
                            onClick={() => handleExport(template)}
                        >
                            Export
                        </button>
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
        </>
    );
}