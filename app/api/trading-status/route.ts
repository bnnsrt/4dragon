import { NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { getTradingSettings, updateTradingSettings } from '@/lib/utils';

export async function GET() {
  try {
    // Get current trading settings
    const settings = getTradingSettings();
    
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching trading settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trading settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const data = await request.json();
    
    // Validate the data
    const { isEnabled, startTime, endTime, weekdaysOnly } = data;
    
    if (typeof isEnabled !== 'boolean' ||
        typeof startTime !== 'string' ||
        typeof endTime !== 'string' ||
        typeof weekdaysOnly !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 }
      );
    }
    
    // Update trading settings
    const updatedSettings = updateTradingSettings({
      isEnabled,
      startTime,
      endTime,
      weekdaysOnly
    });

    return NextResponse.json({
      success: true,
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error updating trading settings:', error);
    return NextResponse.json(
      { error: 'Failed to update trading settings' },
      { status: 500 }
    );
  }
}