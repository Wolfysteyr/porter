<?php

namespace App\Jobs;

use App\Models\QueryTemplate;
use App\Services\ExportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ExportTemplateJob implements ShouldQueue
{
    use InteractsWithQueue, Queueable, SerializesModels;

    protected $templateId;
    public $tries = 3;

    public function __construct(int $templateId)
    {
        $this->templateId = $templateId;
    }

    public function handle(ExportService $exportService)
    {
        Log::info("ExportTemplateJob starting for template {$this->templateId}");

        $tpl = QueryTemplate::find($this->templateId);
        if (!$tpl) {
            Log::warning("ExportTemplateJob: template {$this->templateId} not found");
            return;
        }

        try {
            // Decide type from template->export block or template->query
            $exportType = $tpl->export['export_type'] ?? $tpl->export['exportType'] ?? 1; // assume 0=csv, 1=db
            if ((int)$exportType === 1) {
                $result = $exportService->exportToDb($tpl);
            } else {
                $result = $exportService->exportToCsv($tpl);
            }

            // Optionally store export metadata in exports table (if you have one)
            // \DB::table('exports')->insert([...]);

            // Log the successful export; notifications are intentionally omitted
            Log::info("ExportTemplateJob: template {$tpl->id} exported", $result);
        } catch (\Throwable $e) {
            Log::error("ExportTemplateJob error for template {$this->templateId}: " . $e->getMessage());
            // rethrow if you want to retry
            throw $e;
        }

        Log::info("ExportTemplateJob finished for template {$this->templateId}");
    }
}