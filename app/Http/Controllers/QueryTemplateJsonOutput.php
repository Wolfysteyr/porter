<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use App\Http\Controllers\DataExportController;

class QueryTemplateJsonOutput extends Controller
{
    // function to return a template in plain JSON format when called via API route
    public function runTemplate($template_name)
    {
        $results = DataExportController::getTemplateResults($template_name);

        if ($results instanceof \Illuminate\Http\JsonResponse) {
            return $results;
        }

        return response()->json($results);
    }

    /**
     * Browser-friendly endpoint: returns only JSON (optionally pretty-printed).
     * Visiting /api/templates/{template_name}/json will show just JSON in the page.
     */
    public function viewTemplate($template_name)
    {
        $results = DataExportController::getTemplateResults($template_name);

        if ($results instanceof \Illuminate\Http\JsonResponse) {
            // keep same error format/status codes
            return $results;
        }

        return response()
            ->json($results)
            ->setEncodingOptions(JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
