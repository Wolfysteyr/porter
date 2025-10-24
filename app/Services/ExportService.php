<?php

namespace App\Services;

use App\Models\QueryTemplate;
use App\Http\Controllers\DataExportController;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

class ExportService
{
    protected $dataExportController;

    public function __construct(DataExportController $dataExportController)
    {
        // Inject the controller so we don't duplicate logic. You could instead move logic fully here.
        $this->dataExportController = $dataExportController;
    }

    /**
     * Export a template as CSV and store to storage/app/exports.
     * Returns ['path' => storage_path, 'rows' => int, 'filename' => string]
     */
    public function exportToCsv(QueryTemplate $tpl): array
    {
        // Build a fake Request-like array matching the controller expectations.
        $payload = [
            'template_name' => $tpl->name,
            'database' => $tpl->database,
            'table' => $tpl->table,
            'query' => $tpl->query ?? [],
            'export' => $tpl->export ?? [],
        ];

        // The DataExportController::exportDataCSV expects a Request object;
        // we can call the controller method directly by creating a Request instance.
        $request = new \Illuminate\Http\Request($payload);

        // Call the controller's export method. It returns a Response where content is CSV.
        $response = $this->dataExportController->exportDataCSV($request);

        // If the controller returns JsonResponse on error, bubble that up
        if ($response instanceof \Illuminate\Http\JsonResponse) {
            $data = $response->getData(true);
            throw new \RuntimeException('Export failed: ' . json_encode($data));
        }

        $content = $response->getContent();
        // decide filename; controller already produced one in headers but we re-generate
        $filename = Str::slug($tpl->name) . '_export_' . date('Ymd_His') . '.csv';
        $path = "exports/{$filename}";
        Storage::put($path, $content);

        // Try to infer number of rows: count lines minus header
        $rows = max(0, substr_count($content, PHP_EOL) - 1);

        Log::info("ExportService: stored {$path}, rows={$rows}");

        return [
            'path' => $path,
            'filename' => $filename,
            'rows' => $rows,
        ];
    }

    /**
     * Export to DB — delegate to controller exportDataDB which handles inserts.
     * Returns ['inserted' => n, 'skipped' => m] or similar
     */
    public function exportToDb(QueryTemplate $tpl): array
    {
        $payload = [
            'template_name' => $tpl->name,
            'database' => $tpl->database,
            'table' => $tpl->table,
            'query' => $tpl->query ?? [],
            'export' => $tpl->export ?? [],
        ];
        $request = new \Illuminate\Http\Request($payload);

        $response = $this->dataExportController->exportDataDB($request);

        if ($response instanceof \Illuminate\Http\JsonResponse) {
            $data = $response->getData(true);
            if (isset($data['error'])) {
                Log::error("ExportService: DB export failed for template {$tpl->id}", $data);
                throw new \RuntimeException('DB export failed: ' . json_encode($data));
            }

            return $data;
        }

        // If controller returns plain response or redirect, adapt as needed
        return ['result' => 'ok'];
    }
}