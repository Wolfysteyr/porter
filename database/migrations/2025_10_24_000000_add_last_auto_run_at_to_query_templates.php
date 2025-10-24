<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('query_templates', function (Blueprint $table) {
            $table->timestamp('last_auto_run_at')->nullable()->after('auto');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('query_templates', function (Blueprint $table) {
            $table->dropColumn('last_auto_run_at');
        });
    }
};
