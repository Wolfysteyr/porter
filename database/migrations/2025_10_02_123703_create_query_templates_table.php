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
        Schema::create('query_templates', function (Blueprint $table) {
            $table->id();
            $table->text('name');
            $table->text('database');
            $table->text('table');
            $table->json('query');
            $table->text('export');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->json('auto');
            $table->json('UI');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('query_templates');
    }
};
