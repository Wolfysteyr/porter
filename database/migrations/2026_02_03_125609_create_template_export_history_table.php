<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('template_export_history', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('template_id');
            $table->string('export_type');
            $table->string('file_path')->nullable();
            $table->string('target_database')->nullable();
            $table->string('target_table')->nullable();
            $table->string('message');
            $table->timestamp('exported_at')->useCurrent();
            $table->foreign('template_id')->references('id')->on('query_templates')->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('template_export_history');
    }
};
