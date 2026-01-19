
import { useState, useEffect, useCallback, use } from 'react';

export function useQueryBuilder({ appAddress, token, user, navigate }) {
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

	// Modal & Message 
	const [message, setMessage] = useState("");
	const [messageSuccess, setMessageSuccess] = useState(false);

	// Database Connection 
	const [databases, setDatabases] = useState([]);
	const [newDBName, setNewDBName] = useState("");
	const [newDBdescription, setNewDBdescription] = useState("");
	const [newDBDriver, setNewDBDriver] = useState("mysql");
	const [newDBHost, setNewDBHost] = useState("127.0.0.1");
	const [newDBPort, setNewDBPort] = useState("3306");
	const [newDBUsername, setNewDBUsername] = useState("root");
	const [newDBPassword, setNewDBPassword] = useState("");

	// Query Builder 
	const [tables, setTables] = useState([]);
	const [selectedDatabase, setSelectedDatabase] = useState("");
	const [selectedTable, setSelectedTable] = useState("");
	const [rowLimit, setRowLimit] = useState("");
	const [selectedCols, setSelectedCols] = useState([]);
	const [selectedWhere, setSelectedWhere] = useState([]);
	const [foreignKeysSelection, setForeignKeysSelection] = useState([]);
	const [selectedRFKs, setSelectedRFKs] = useState({});
	const [tableData, setTableData] = useState([]);
	const [tableCols, setTableCols] = useState([]);
	const [foreignKeys, setForeignKeys] = useState([]);
	const [updatedData, setUpdatedData] = useState(false);

	// Template/Export/Automation 
	const [templateName, setTemplateName] = useState("");
	const [templateNameErr, setTemplateNameErr] = useState(false);
	const [templateNameErrMsg, setTemplateNameErrMsg] = useState("");
	const [exportType, setExportType] = useState(false);
	const [columnNameChanges, setColumnNameChanges] = useState([]);
	const [FRRules, setFRRules] = useState([]);
	const [limitOffsetRules, setLimitOffsetRules] = useState([]);
	const [isAutomated, setIsAutomated] = useState(false);
	const [automationSchedule, setAutomationSchedule] = useState('every');
	const [automationPeriod, setAutomationPeriod] = useState('5');
	const [automationUnit, setAutomationUnit] = useState('minutes');

	// Export Target 
	const [targetDatabase, setTargetDatabase] = useState("");
	const [targetTable, setTargetTable] = useState("");
	const [dbTables, setDbTables] = useState([]);

	// Derived Values for UI
	const selectedColsCount = Array.isArray(selectedCols) ? selectedCols.length : 0;
	const selectedRFKsCount = selectedRFKs && typeof selectedRFKs === 'object'
		? Object.values(selectedRFKs).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
		: 0;

	// Logic functions (moved from TQB.jsx)

	// Save template logic
	function handleSaveTemplate() {
		setTemplateNameErr(false);

		let query = {};
		if (Array.isArray(selectedCols) && selectedCols.length > 0) query.columns = selectedCols;

		if (Array.isArray(foreignKeysSelection) && foreignKeysSelection.length > 0) {
			query.foreign_keys = foreignKeysSelection;
		} else if (selectedRFKs && Object.keys(selectedRFKs).length > 0) {
			const derived = Object.keys(selectedRFKs).map((parentCol) => {
				const fkMeta = Array.isArray(foreignKeys)
					? foreignKeys.find(f => f.column_name === parentCol)
					: Object.values(foreignKeys || {}).find(f => f.column_name === parentCol);
				const tableName = fkMeta?.referenced_table || null;
				const fkCols = Array.isArray(selectedRFKs[parentCol]) ? selectedRFKs[parentCol] : [];
				return { parentCol, fkTables: tableName ? [{ tableName, fkColumns: fkCols }] : [] };
			}).filter(item => item.fkTables && item.fkTables.length > 0);
			if (derived.length > 0) query.foreign_keys = derived;
		}

		if (Array.isArray(selectedWhere) && selectedWhere.length > 0) query.where = selectedWhere;
		if (Object.keys(query).length === 0) query.columns = ["*"];

		let auto = {};
		if (isAutomated) {
			if (automationSchedule !== 'every') auto = { schedule: automationSchedule, interval: null, unit: null };
			else auto = { schedule: automationSchedule, interval: automationPeriod, unit: automationUnit };
		} else auto = { schedule: null, interval: null, unit: null };

		let UI = { toggles, selectedRFKs };
		let eggsport = { exportType, targetDatabase, targetTable, findReplaceRules: FRRules, limitOffsetRules, columnNameChanges };

		let automation = { enabled: false };
		if (isAutomated) {
			if (automationSchedule === 'Every ...') {
				const n = Number(automationPeriod);
				if (!n || n <= 0) {
					showMessage('Please provide a positive number for automation interval.', false);
					return;
				}
				automation = { enabled: true, schedule: automationSchedule, interval: n, unit: automationUnit };
			} else if (automationSchedule) automation = { enabled: true, schedule: automationSchedule };
			else { showMessage('Please choose an automation schedule or disable automation.', false); return; }
		}

		const payload = { name: templateName, database: selectedDatabase, table: selectedTable, query, export: eggsport, automation, user_id: user.id, auto, UI };

		fetch(`${appAddress}/api/query-templates`, {
			method: "POST",
			headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', "Content-Type": "application/json" },
			body: JSON.stringify(payload)
		})
			.then(async response => {
				const data = await response.json();
				if (!response.ok) {
					const errorMsg = data?.message || "An error occurred";
					setTemplateNameErr(true);
					setTemplateNameErrMsg(errorMsg);
					throw new Error(errorMsg);
				}
				setTemplateNameErr(false);
				setTemplateNameErrMsg("");
				navigate("/templates", { state: { message: "Template saved successfully!" } });
			})
			.catch(error => console.error("Error saving template:", error));
	}
	async function getDatabases() {
		try {
			const response = await fetch(`${appAddress}/api/databases/external`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!response.ok) throw new Error(`Status ${response.status}`);
			const data = await response.json();
			setDatabases(Array.isArray(data) ? data : []);
		} catch (err) {
			setDatabases([]);
		}
	}

	async function handleCreateNewDatabase() {
		toggleLoading(true);
		const payload = {
			name: newDBName,
			description: newDBdescription,
			driver: newDBDriver,
			host: newDBHost,
			port: newDBPort,
			username: newDBUsername,
			password: newDBPassword
		};
		try {
			const response = await fetch(`${appAddress}/api/databases/external`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(payload),
			});
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

	function showMessage(msg, success) {
		setMessage(msg);
		setMessageSuccess(success);
		setIsMessageModalOpen(true);
		setTimeout(() => {
			setIsMessageModalOpen(false);
		}, 3000);
	}

	const toggleExportType = () => {
		setExportType(prev => !prev);
		setColumnNameChanges([]);
		if (exportType) {
			setColumnNameChanges(prev => [...prev, { original: '', new: '' }]);
		}
	};

	const handleAutomationToggle = (checked) => {
		const next = typeof checked === 'boolean' ? checked : !isAutomated;
		setIsAutomated(next);
		if (!next) {
			setAutomationSchedule('every');
			setAutomationPeriod('5');
			setAutomationUnit('minutes');
		} else {
			setAutomationSchedule(prev => prev || 'Daily');
		}
	};

	const toggle = (id) => {
		setToggles((prev) => ({ ...prev, [id]: !prev[id] }));
	};
	const isToggled = (id) => !!toggles[id];

	const addFRRule = () => setFRRules((prev) => [...prev, { find: "", replace: "" }]);
	const addLimitOffset = () => setLimitOffsetRules((prev) => [...prev, { limit: 1000, offset: 0 }]);
	const handleFRRuleChange = (index, field, value) => setFRRules((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
	const handleLimitOffsetChange = (index, field, value) => setLimitOffsetRules((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
	const handleColumnNameChange = useCallback((index, field, value) => {
		setColumnNameChanges((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
	}, []);
	const removeFRRule = (index) => setFRRules((prev) => prev.filter((_, i) => i !== index));
	const removeLimitOffsetRule = (index) => setLimitOffsetRules((prev) => prev.filter((_, i) => i !== index));
	const removeColumnChange = (index) => setColumnNameChanges((prev) => prev.filter((_, i) => i !== index));

	const handleChange = (col) => {
		setSelectedCols((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]);
	};

	const WHERE_OPERATORS = [
		'=', '!=', '<', '<=', '>', '>=',
		'LIKE', 'NOT LIKE', 'IN', 'NOT IN',
		'IS NULL', 'IS NOT NULL'
	];

	const handleSelectedWhere = (e, idx) => {
		const val = e.target.value;
		setSelectedWhere((prev = []) => {
			const copy = [...prev];
			if (idx === copy.length) {
				if (!val) return copy;
				return [...copy, { column: val, operator: '=', value: '' }];
			}
			if (!val) {
				if (copy.length > 1) {
					copy.splice(idx, 1);
					return copy;
				}
				return [];
			}
			copy[idx] = { ...(copy[idx] || {}), column: val, operator: copy[idx]?.operator ?? '=', value: copy[idx]?.value ?? '' };
			return copy;
		});
	};

	const handleWhereOperatorChange = (idx, operator) => {
		setSelectedWhere((prev = []) => {
			const copy = [...prev];
			if (!copy[idx]) return copy;
			copy[idx] = { ...copy[idx], operator };
			if (operator === 'IS NULL' || operator === 'IS NOT NULL') copy[idx].value = '';
			return copy;
		});
	};

	const handleWhereValueChange = (idx, value) => {
		setSelectedWhere((prev = []) => {
			const copy = [...prev];
			if (!copy[idx]) return copy;
			copy[idx] = { ...copy[idx], value };
			return copy;
		});
	};

	function handleFKSelection(parentCol, tableName, fkColumn) {
		setSelectedRFKs((prev) => {
			const copy = { ...prev };
			const list = Array.isArray(copy[parentCol]) ? [...copy[parentCol]] : [];
			const idx = list.indexOf(fkColumn);
			if (idx === -1) list.push(fkColumn); else list.splice(idx, 1);
			if (list.length) copy[parentCol] = list; else delete copy[parentCol];
			return copy;
		});

		setForeignKeysSelection((prev) => {
			const copy = prev.map(p => ({ parentCol: p.parentCol, fkTables: p.fkTables.map(t => ({ tableName: t.tableName, fkColumns: [...t.fkColumns] })) }));
			const parentIdx = copy.findIndex(p => p.parentCol === parentCol);
			if (parentIdx === -1) {
				return [...copy, { parentCol, fkTables: [{ tableName, fkColumns: [fkColumn] }] }];
			}
			const parent = copy[parentIdx];
			const tableIdx = parent.fkTables.findIndex(t => t.tableName === tableName);
			if (tableIdx === -1) parent.fkTables.push({ tableName, fkColumns: [fkColumn] });
			else {
				const table = parent.fkTables[tableIdx];
				const colIdx = table.fkColumns.indexOf(fkColumn);
				if (colIdx === -1) table.fkColumns.push(fkColumn);
				else {
					table.fkColumns.splice(colIdx, 1);
					if (table.fkColumns.length === 0) parent.fkTables.splice(tableIdx, 1);
				}
			}
			if (parent.fkTables.length === 0) copy.splice(parentIdx, 1);
			return copy;
		});
	}

	function resetRules() {
		setSelectedCols([]);
		setSelectedWhere([]);
		setForeignKeysSelection([]);
		setSelectedRFKs([]);
		setRowLimit("");
		setUpdatedData(false);
	}

	function handleMenuToggle() {
		setIsMenuOpen(!isMenuOpen);
	}

	function toggleMenus(menuName) {
		setMenus(prevState => {
			const newState = {};
			Object.keys(prevState).forEach(key => { newState[key] = false; });
			newState[menuName] = !prevState[menuName];
			return newState;
		});
	}

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
		loading, toggleLoading, templateNameErr, setTemplateNameErr, templateNameErrMsg, setTemplateNameErrMsg, message, setMessage, messageSuccess, setMessageSuccess, isMessageModalOpen, setIsMessageModalOpen, showWarning, setShowWarning, showSuccessGlow, setShowSuccessGlow, showColumnWindow, setShowColumnWindow, columnNameChanges, setColumnNameChanges, FRRules, setFRRules, limitOffsetRules, setLimitOffsetRules, tables, setTables, databases, setDatabases, newDBName, setNewDBName, newDBdescription, setNewDBdescription, newDBDriver, setNewDBDriver, newDBHost, setNewDBHost, newDBPort, setNewDBPort, newDBUsername, setNewDBUsername, newDBPassword, setNewDBPassword, selectedDatabase, setSelectedDatabase, selectedTable, setSelectedTable, rowLimit, setRowLimit, selectedCols, setSelectedCols, selectedWhere, setSelectedWhere, foreignKeysSelection, setForeignKeysSelection, templateName, setTemplateName, exportType, setExportType, toggles, setToggles, selectedRFKs, setSelectedRFKs, toggleNewDBModal, setToggleNewDBModal, isMenuOpen, setIsMenuOpen, menus, setMenus, selectedColsCount, selectedRFKsCount, isAutomated, setIsAutomated, automationSchedule, setAutomationSchedule, automationPeriod, setAutomationPeriod, automationUnit, setAutomationUnit, tableData, setTableData, tableCols, setTableCols, foreignKeys, setForeignKeys, targetDatabase, setTargetDatabase, targetTable, setTargetTable, dbTables, setDbTables, updatedData, setUpdatedData,
		getDatabases, handleCreateNewDatabase, showMessage, toggleExportType, handleAutomationToggle, toggle, isToggled, addFRRule, addLimitOffset, handleFRRuleChange, handleLimitOffsetChange, handleColumnNameChange, removeFRRule, removeLimitOffsetRule, removeColumnChange, handleChange, WHERE_OPERATORS, handleSelectedWhere, handleWhereOperatorChange, handleWhereValueChange, handleFKSelection, resetRules, handleMenuToggle, toggleMenus, handleNewDatabase, handleSaveTemplate
	};
}