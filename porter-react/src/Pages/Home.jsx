import { useContext } from "react";
import { AppContext } from "../Context/AppContext";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useState } from "react";
import { PieChart, pieArcLabelClasses } from "@mui/x-charts/PieChart";

export default function Home() {
    const { appAddress, token } = useContext(AppContext);

    const [templates, setTemplates] = useState([]);
    const [databases, setDatabases] = useState([]);

    const { user } = useContext(AppContext);

    useEffect(() => {
        document.title = "Porter";
        // get templates for user dashboard
        async function fetchTemplates() {
            try {
                const response = await fetch(
                    `${appAddress}/api/query-templates`,
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: "application/json",
                        },
                    },
                );
                const data = await response.json();
                // sort by last_auto_run_at desc (most recent first), treat missing/invalid dates as oldest
                const getTime = (t) => {
                    const ms = t ? Date.parse(t) : NaN;
                    return Number.isFinite(ms) ? ms : 0;
                };
                data.sort(
                    (a, b) =>
                        getTime(b.last_auto_run_at) -
                        getTime(a.last_auto_run_at),
                );
                setTemplates(data);
            } catch {
                setTemplates([]);
            }
        }

        async function fetchDatabases() {
            try {
                const response = await fetch(
                    `${appAddress}/api/databases/external`,
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: "application/json",
                        },
                    },
                );
                const data = await response.json();
                setDatabases(data);
            } catch {
                setDatabases([]);
            }
        }

        if (user) {
            fetchTemplates();
            fetchDatabases();
        }
    }, [user, appAddress, token]);

    // helper: format "seconds/minutes/hours/days ago"
    const formatTimeAgo = (iso) => {
        const ms = Date.parse(iso);
        if (!Number.isFinite(ms)) return "just now";
        const diff = Date.now() - ms;
        if (diff < 5000) return "just now";
        const sec = Math.floor(diff / 1000);
        if (sec < 60) return `${sec} second${sec === 1 ? "" : "s"} ago`;
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
        const days = Math.floor(hr / 24);
        return `${days} day${days === 1 ? "" : "s"} ago`;
    };

    const hexToRgba = (hex, alpha) => {
        if (!hex || hex[0] !== "#" || hex.length !== 7) return hex;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const palette = [
        "#4E79A7",
        "#2ba2f2",
        "#E15759",
        "#76B7B2",
        "#59A14F",
        "#EDC949",
        "#AF7AA1",
        "#FF9DA7",
        "#9C755F",
        "#BAB0AC",
    ];

    const getDatabaseLabel = (template) => {
        const db = template?.database;
        if (!db) return "Unknown";
        if (typeof db === "string") return db;
        return db.name || db.label || db.database || "Unknown";
    };

    const getTemplateName = (template) =>
        template?.name || template?.title || `Template ${template?.id ?? ""}`;

    const databaseTotals = templates.reduce((acc, template) => {
        const label = getDatabaseLabel(template);
        const isActive = Boolean(template?.auto?.active);
        if (!acc[label]) {
            acc[label] = {
                total: 0,
                active: 0,
                inactive: 0,
                templates: [],
                activeTemplates: [],
                inactiveTemplates: [],
            };
        }
        acc[label].total += 1;
        acc[label].templates.push(getTemplateName(template));
        if (isActive) {
            acc[label].active += 1;
            acc[label].activeTemplates.push(getTemplateName(template));
        } else {
            acc[label].inactive += 1;
            acc[label].inactiveTemplates.push(getTemplateName(template));
        }
        return acc;
    }, {});

    const databaseLabels = Object.keys(databaseTotals).sort();

    const databaseData = databaseLabels.map((label, index) => ({
        id: label,
        label,
        value: databaseTotals[label].total,
        color: palette[index % palette.length],
        templates: databaseTotals[label].templates,
    }));

    const databaseActiveInactiveData = databaseLabels.flatMap(
        (label, index) => {
            const baseColor = palette[index % palette.length];
            const { active, inactive, activeTemplates, inactiveTemplates } =
                databaseTotals[label];
            return [
                {
                    id: `${label}-active`,
                    label: "Active",
                    value: active,
                    color: baseColor,
                    templates: activeTemplates,
                },
                {
                    id: `${label}-inactive`,
                    label: "Inactive",
                    value: inactive,
                    color: hexToRgba(baseColor, 0.4),
                    templates: inactiveTemplates,
                },
            ].filter((item) => item.value > 0);
        },
    );

    const databaseSeries = [
        {
            id: "databases",
            innerRadius: 40,
            outerRadius: 110,
            data: databaseData,
            arcLabel: (item) => `${item.label}`,
            valueFormatter: (item) => {
                const list = item.templates?.join(", ") || "None";
                return `${item.value} template${item.value !== 1 ? "s" : ""}\n ${list}`;
            },
        },
        {
            id: "db-status",
            innerRadius: 115,
            outerRadius: 140,
            data: databaseActiveInactiveData,
            arcLabel: (item) => item.label,
            valueFormatter: (item) => {
                const list = item.templates?.join(", ") || "None";
                return `${item.value} template${item.value !== 1 ? "s" : ""}\n ${list}`;
            },
        },
    ];

    return (
        <>
            {user ? (
                <div className="main-div">
                    <h2 className="title">Welcome, {user.name}</h2>

                    <div className="dashboard">
                        <div>
                            <p className="tile-title">Last Auto Runs</p>
                            <div className="auto-run-tile">
                                <ul>
                                    {templates.length > 0 ? (
                                        templates
                                            .slice(0, 5)
                                            .map((template) => (
                                                <li key={template.id}>
                                                    <Link
                                                        className="template-link"
                                                        to={`/templates/`}
                                                        state={{
                                                            template:
                                                                template.id,
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                overflow:
                                                                    "ellipsis",
                                                                whiteSpace:
                                                                    "nowrap",
                                                                textOverflow:
                                                                    "ellipsis",
                                                            }}
                                                        >
                                                            {template.name}
                                                        </span>{" "}
                                                        {" - "}
                                                        {template.last_auto_run_at
                                                            ? formatTimeAgo(
                                                                  template.last_auto_run_at,
                                                              )
                                                            : "Never"}
                                                    </Link>
                                                </li>
                                            ))
                                    ) : (
                                        <li>No templates found.</li>
                                    )}
                                </ul>
                            </div>
                        </div>



                        <div className="metrics-tile">
                            <p className="tile-title">Metrics</p>
                            <div className="tile-content metrics-content">
                               <PieChart
                                    series={databaseSeries}
                                    width={320}
                                    height={320}
                                    sx={{
                                        [`& .${pieArcLabelClasses.root}`]: {
                                            fontSize: "10px",
                                        },
                                    }}
                                    hideLegend
                                />

                            </div>
                        </div>

                        <div className="changelog-tile">
                            <p className="tile-title">Changelog</p>
                            <div className="tile-content changelog-content">
                                <div className="changelog-title">
                                    <strong>v1.0.0.0 (example)</strong>
                                    <h6>29.01.2026</h6>
                                </div>

                                <ul>
                                    <li>Added feature X to improve Y.</li>
                                    <li>Fixed bug in Z that caused A.</li>
                                    <ul>
                                        <li>Sub-point about the bug fix.</li>
                                    </ul>
                                    <li>Improved performance of B by C%.</li>
                                    <li>Updated documentation for D.</li>

                                   <h6>P.S. Gotta figure out how to make this dynamic...</h6> 
                                </ul>
                            </div>
                        </div>

                        
                    </div>
                </div>
            ) : (
                <h2 className="title">Please log in to continue.</h2>
            )}
        </>
    );
}
