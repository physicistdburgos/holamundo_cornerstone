# Ruta de la carpeta que contiene los archivos .dcm
$carpeta = "C:\Users\dburgos\PARA\1._Project\Tratamiento_de_imagenes\Cornerstone_VScode_Javascript\rtdose-viewer\solo_CTs"

# Obtener todos los archivos .dcm ordenados por nombre (puedes cambiar el criterio)
$archivos = Get-ChildItem -Path $carpeta -Filter "*.dcm" | Sort-Object Name

# Contador inicial
$contador = 1

foreach ($archivo in $archivos) {
    # Generar nombre nuevo con tres dígitos, por ejemplo 001.dcm, 002.dcm, etc.
    $nuevoNombre = "{0:D3}.dcm" -f $contador
    $rutaNueva = Join-Path $carpeta $nuevoNombre

    # Renombrar el archivo
    Rename-Item -Path $archivo.FullName -NewName $rutaNueva

    $contador++
}
