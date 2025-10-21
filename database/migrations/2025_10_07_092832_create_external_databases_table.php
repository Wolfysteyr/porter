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
        Schema::create('external_databases', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // name of the external database connection
            $table->string('description')->nullable(); // optional description
            $table->string('driver')->default('mysql');
            $table->string('host');
            $table->string('port')->default('3306');
            $table->string('username');
            $table->string('password')->nullable()->encrypt(); // consider encrypting
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('external_databases');
    }
};
