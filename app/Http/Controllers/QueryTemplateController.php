<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\QueryTemplate;
use Illuminate\Validation\Rule;

class QueryTemplateController extends Controller
{
    public function __construct()
    {
        // apply auth middleware if desired
        // $this->middleware('auth:api');
    }

    public function index()
    {
        return response()->json(QueryTemplate::all());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|unique:query_templates,name',
            'database' => 'required|string',
            'table' => 'required|string',
            'query' => 'required|array',
            'export' => 'required|array',
            'user_id' => 'nullable|integer|exists:users,id',
            'UI' => 'sometimes|array',
        ]);

        $tpl = new QueryTemplate();
        $tpl->name = $data['name'];
        $tpl->database = $data['database'];
        $tpl->table = $data['table'];
        $tpl->query = $data['query'];
        $tpl->export = $data['export'] ?? [];
        $tpl->user_id = $data['user_id'] ?? null;
        $tpl->UI = $data['UI'] ?? null;
        $tpl->save();

        return response()->json($tpl, 201);
    }

    public function show($id)
    {
        return response()->json(QueryTemplate::findOrFail($id));
    }

    public function update(Request $request, $id)
    {
        $tpl = QueryTemplate::findOrFail($id);

        $data = $request->validate([
            'name' => [
                'required',
                'string',
                Rule::unique('query_templates', 'name')->ignore($tpl->id),
            ],
            'database' => 'required|string',
            'table' => 'required|string',
            'query' => 'required|array',
            'export' => 'required|array',
            'user_id' => 'nullable|integer|exists:users,id',
            'UI' => 'sometimes|array',
        ]);

        // update existing model
        $tpl->name = $data['name'];
        $tpl->database = $data['database'];
        $tpl->table = $data['table'];
        $tpl->query = $data['query'];
        $tpl->export = $data['export'];
        $tpl->user_id = $data['user_id'] ?? $tpl->user_id;
        $tpl->UI = $data['UI'] ?? $tpl->UI;
        $tpl->save();

        return response()->json($tpl, 200);
    }

    public function destroy($id)
    {
        QueryTemplate::findOrFail($id)->delete();
        return response()->json(null, 204);
    }
}
