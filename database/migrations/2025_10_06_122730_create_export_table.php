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
        Schema::create('exports', function (Blueprint $table) {
            $table->id();
            $table->string('name');          // human-friendly label ("Orders export")
            $table->unsignedBigInteger('user_id')->nullable();       // who triggered it
            $table->string('source_db');     // source database name or connection key
            $table->string('source_table');  // table queried
            $table->string('target_db')->nullable();     // (optional) target database name/connection key
            $table->string('target_table')->nullable();  // (optional) table to insert into
            $table->string('transfer_type')->default('csv'); // 'csv' or 'direct'
            $table->string('csv_path')->nullable();      // path/URL to CSV (null if direct transfer)
            $table->unsignedBigInteger('row_count')->nullable();     // how many rows were exported
            $table->string('status')->default('pending');        // 'pending', 'success', 'failed'
            $table->text('error_message')->nullable(); // store error if failed

            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('export');
    }
};
