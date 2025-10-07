import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Fragment } from 'react';
import { useContext } from 'react';
import { AppContext } from '../../Context/AppContext';

export default function Export() {
    const location = useLocation();
    const navigate = useNavigate();
    const [template, setTemplate] = useState({});
    const [isQueryHidden, setIsQueryHidden] = useState(true);
    const [showRules, setShowRules] = useState(false);

    const { token }  = useContext(AppContext);
 
    useEffect(() => {
        if (location.state && location.state.template) {
            setTemplate(location.state.template);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate]);

    useEffect(() => {
        if (!template.name) {
            const timer = setTimeout(() => {
                navigate('/templates');
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [template, navigate]);

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
            const response = await fetch('http://localhost:8000/api/databases/external/export', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(template)
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
                                    <button
                                        style={{ marginBottom: '1rem' }}
                                        onClick={() => setIsQueryHidden(!isQueryHidden)}
                                        title='Click to see the full query details if you understand them'
                                    >
                                        {isQueryHidden ? 'Show Query' : 'Show Simple'}
                                    </button>

                                    <p
                                        className={isQueryHidden ? `` : `hidden`}
                                        style={{ fontStyle: 'italic', marginTop: '1rem' }}
                                    >
                                        This will export <strong className='columns-count'
                                            title={
                                                Array.isArray(query.columns)
                                                    ? query.columns[0] === "*" ? "*" :
                                                        query.columns.join('\n')   
                                                    : String(query.columns ?? '')
                                            }
                                            
                                        >
                                            { !Array.isArray(query.columns) || query.columns[0] === "*" ? "all" : columnsCount}
                                        </strong>{' '}
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
                                            width: '40%',
                                            height: 'fit-content'
                                        }}
                                    />
                                </div>
                            </div>
                            {showRules && (
                            <div className='export-rules'>
                                <h3>Export Rules</h3>
                                <ul>
                                    <li>Only selected fields will be exported.</li>
                                    <li>Data will be exported in CSV format.</li>
                                    <li>Ensure all fields are correctly mapped.</li>
                                </ul>
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
                            <button className="export-button" onClick={() => setShowRules(true)}>
                                Add Rules
                            </button>
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